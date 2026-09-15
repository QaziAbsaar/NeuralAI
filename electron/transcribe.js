// NeuralAir transcription — Phase 1, step 5; provider layer in Phase 4.
// Provider-agnostic STT. Cloud: Groq Whisper (default), OpenAI
// (gpt-4o-transcribe family), Deepgram Nova-3, AssemblyAI Universal, and
// ElevenLabs Scribe — all BYOK. Local: whisper.cpp (no key, offline). The
// active provider comes from settings ('auto' tries Groq first and fails
// over to local when it is down or slow; every other value pins one).
const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const OPENAI_TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions'
const DEEPGRAM_TRANSCRIBE_URL = 'https://api.deepgram.com/v1/listen'
const ASSEMBLYAI_TRANSCRIBE_URL = 'https://api.assemblyai.com/v2/transcript'
const ELEVENLABS_TRANSCRIBE_URL = 'https://api.elevenlabs.io/v1/speech-to-text'
const GROQ_MODEL = 'whisper-large-v3-turbo'
// How long a cloud request waits before 'auto' mode fails over to local.
const CLOUD_TIMEOUT_MS = 12000
// Default STT models for providers with a choice; settings.sttModel overrides.
const DEFAULT_STT_MODELS = {
  openai: 'gpt-4o-mini-transcribe',
  deepgram: 'nova-3',
  assemblyai: 'universal-2',
  elevenlabs: 'scribe_v1',
}
// Prime Whisper with dictation context: on short, context-free clips the
// model otherwise hallucinates stock phrases ("Thank you.", "Thanks for
// watching!") instead of transcribing what was actually said.
const PROMPT_HINT =
  'A short voice dictation by the user, transcribed exactly as spoken. Not a video, not a conversation.'

// Tiny .env loader — avoids a dotenv dependency for one file.
// Expects KEY=VALUE lines in <project root>/.env; never overrides real env.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSettings } from './settings.js'

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

export function loadEnv() {
  const envPath = path.join(projectRoot, '.env')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2]
    }
  }
}

// Which provider a request should use. 'auto' = Groq with local failover;
// anything else pins one provider; default 'auto'.
function providerChoice() {
  return loadSettings().sttProvider || 'auto'
}

// whisper.cpp binary + model, defaulting to NeuralAir's install layout.
function whisperPaths() {
  const s = loadSettings()
  return {
    bin: s.whisperCppPath || path.join(process.env.HOME || '', '.local/share/neuralair/whisper.cpp/build/bin/whisper-cli'),
    model: s.whisperModelPath || path.join(process.env.HOME || '', '.local/share/neuralair/whisper.cpp/models/ggml-base.en.bin'),
  }
}

async function transcribeGroq(bytes, mimeType, apiKey, model) {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: mimeType }), 'dictation.webm')
  form.append('model', model)
  form.append('response_format', 'json')
  form.append('temperature', '0')
  form.append('prompt', PROMPT_HINT)

  // Pin the dictation language (ISO-639-1, e.g. "en", "is", "ur").
  // Whisper's auto-detect hallucinates whole wrong languages on short or
  // context-free speech (isolated numbers, single words). Unset = auto-detect.
  const language = process.env.DICTATION_LANGUAGE
  if (language) form.append('language', language)

  const response = await fetch(GROQ_TRANSCRIBE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Groq API ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  return data.text
}

// OpenAI's audio API is the same shape Groq re-implements, so this is nearly
// a copy of transcribeGroq with a different URL, model list, and key. The
// prompt hint and language pin carry over verbatim.
async function transcribeOpenai(bytes, mimeType, apiKey, model) {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: mimeType }), 'dictation.webm')
  form.append('model', model)
  form.append('response_format', 'json')
  form.append('prompt', PROMPT_HINT)

  const language = process.env.DICTATION_LANGUAGE
  if (language) form.append('language', language)

  const response = await fetch(OPENAI_TRANSCRIBE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`OpenAI API ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  return data.text
}

// Deepgram takes the raw audio bytes as the request body with everything
// else as query params. `punctuate` and `smart_format` give dictation-ready
// casing and punctuation before any LLM pass.
async function transcribeDeepgram(bytes, mimeType, apiKey, model) {
  const params = new URLSearchParams({
    model,
    smart_format: 'true',
    punctuate: 'true',
  })
  const language = process.env.DICTATION_LANGUAGE
  if (language) params.set('language', language)

  const response = await fetch(`${DEEPGRAM_TRANSCRIBE_URL}?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': mimeType,
    },
    body: bytes,
    signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Deepgram API ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  // The batch response shape is results.channels[0].alternatives[0].transcript.
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
}

// AssemblyAI is async: upload, poll until the transcript is ready. A short
// dictation usually completes in one or two polls.
async function transcribeAssemblyai(bytes, mimeType, apiKey, model) {
  const upload = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/octet-stream',
    },
    body: bytes,
    signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS),
  })
  if (!upload.ok) {
    throw new Error(`AssemblyAI upload ${upload.status}: ${await upload.text()}`)
  }
  const { upload_url: uploadUrl } = await upload.json()

  const create = await fetch(ASSEMBLYAI_TRANSCRIBE_URL, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: uploadUrl,
      speech_model: model,
      language_code: process.env.DICTATION_LANGUAGE || 'en',
    }),
    signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS),
  })
  if (!create.ok) {
    throw new Error(`AssemblyAI create ${create.status}: ${await create.text()}`)
  }
  const { id } = await create.json()

  // Poll for the result — queued → processing → completed/error.
  for (let attempt = 0; attempt < 30; attempt++) {
    const poll = await fetch(`${ASSEMBLYAI_TRANSCRIBE_URL}/${id}`, {
      headers: { Authorization: apiKey },
      signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS),
    })
    if (!poll.ok) {
      throw new Error(`AssemblyAI poll ${poll.status}: ${await poll.text()}`)
    }
    const data = await poll.json()
    if (data.status === 'completed') return data.text ?? ''
    if (data.status === 'error') throw new Error(`AssemblyAI job failed: ${data.error ?? 'unknown'}`)
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('AssemblyAI transcription timed out')
}

// ElevenLabs Scribe: multipart upload, speech_to_text endpoint. The
// language tag can be forced; `diarize` is pointless for single-speaker
// dictation so it stays off.
async function transcribeElevenlabs(bytes, mimeType, apiKey, model) {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: mimeType }), 'dictation.webm')
  form.append('model_id', model)
  const language = process.env.DICTATION_LANGUAGE
  if (language) form.append('language_code', language)

  const response = await fetch(ELEVENLABS_TRANSCRIBE_URL, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: form,
    signal: AbortSignal.timeout(CLOUD_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`ElevenLabs API ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  return data.text
}

// whisper.cpp reads 16kHz mono WAV from stdin ("-f -"), so the webm/opus
// buffer is decoded and resampled by ffmpeg in a pipe — the audio still
// never touches disk.
async function transcribeWhisperCpp(bytes, mimeType) {
  const { bin, model } = whisperPaths()
  if (!fs.existsSync(bin)) throw new Error(`whisper.cpp not found at ${bin}`)
  if (!fs.existsSync(model)) throw new Error(`whisper.cpp model not found at ${model}`)

  const { spawn } = await import('node:child_process')
  const ffmpeg = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-ar', '16000', '-ac', '1', '-f', 'wav', 'pipe:1'])
  // "-of /dev/stderr" is a trick: with output routed to "-" whisper-cli
  // disables its segment-print callback (and its ofstream /dev/stdout writes
  // nothing when stdout is a pipe). Pointing -of at /dev/stderr keeps the
  // callback alive — segments land on real stdout via printf. No output
  // format flags are passed, so nothing is ever actually written to
  // /dev/stderr.
  const whisper = spawn(bin, ['-f', '-', '-m', model, '-of', '/dev/stderr', '-nt', '-np'], { stdio: ['pipe', 'pipe', 'pipe'] })

  return new Promise((resolve, reject) => {
    let text = ''
    whisper.stdout.on('data', (chunk) => (text += chunk))
    whisper.on('error', reject)
    whisper.on('close', (code) => {
      if (code === 0) resolve(text.trim())
      else reject(new Error(`whisper-cli exited with ${code}`))
    })
    ffmpeg.on('error', reject)
    ffmpeg.stdout.pipe(whisper.stdin)
    ffmpeg.stderr.on('data', (c) => console.error(`[whisper.cpp] ffmpeg: ${c}`))
    ffmpeg.stdin.write(Buffer.from(bytes))
    ffmpeg.stdin.end()
  })
}

// One pinned cloud provider, selected by name. Throws if its key is missing
// so the caller can surface a clear error (pinned means pinned — no silent
// failover to a different provider the user did not choose).
async function transcribeCloud(provider, bytes, mimeType) {
  const s = loadSettings()
  const model = s.sttModel || DEFAULT_STT_MODELS[provider] || ''
  switch (provider) {
    case 'groq': {
      const apiKey = process.env.GROQ_API_KEY
      if (!apiKey) throw new Error('GROQ_API_KEY not set (put it in .env or settings)')
      return transcribeGroq(bytes, mimeType, apiKey, model || GROQ_MODEL)
    }
    case 'openai': {
      if (!s.openaiSttKey) throw new Error('OpenAI STT key not set (Settings → Providers)')
      return transcribeOpenai(bytes, mimeType, s.openaiSttKey, model)
    }
    case 'deepgram': {
      if (!s.deepgramSttKey) throw new Error('Deepgram STT key not set (Settings → Providers)')
      return transcribeDeepgram(bytes, mimeType, s.deepgramSttKey, model)
    }
    case 'assemblyai': {
      if (!s.assemblyaiSttKey) throw new Error('AssemblyAI STT key not set (Settings → Providers)')
      return transcribeAssemblyai(bytes, mimeType, s.assemblyaiSttKey, model)
    }
    case 'elevenlabs': {
      if (!s.elevenlabsSttKey) throw new Error('ElevenLabs STT key not set (Settings → Providers)')
      return transcribeElevenlabs(bytes, mimeType, s.elevenlabsSttKey, model)
    }
    default:
      throw new Error(`Unknown STT provider: ${provider}`)
  }
}

export async function transcribe(bytes, mimeType) {
  const provider = providerChoice()

  if (provider === 'local') return transcribeWhisperCpp(bytes, mimeType)
  if (provider !== 'auto') return transcribeCloud(provider, bytes, mimeType)

  // 'auto': Groq first, whisper.cpp failover. A missing key skips straight
  // to local — the dictation still works offline.
  if (process.env.GROQ_API_KEY) {
    try {
      return await transcribeCloud('groq', bytes, mimeType)
    } catch (err) {
      console.error(`[transcribe] Groq failed (${err.message}), trying whisper.cpp`)
    }
  } else {
    console.log('[transcribe] no Groq key, using whisper.cpp')
  }
  return transcribeWhisperCpp(bytes, mimeType)
}
