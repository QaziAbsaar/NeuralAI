// NeuralAir transcription — Phase 1, step 5; provider layer in Phase 4.
// Provider-agnostic STT: Groq Whisper (cloud, default) and whisper.cpp
// (local, no key, offline). The active provider comes from settings
// ('auto' tries Groq first and fails over to local when it is down or slow).
const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const GROQ_MODEL = 'whisper-large-v3-turbo'
// How long 'auto' mode waits on Groq before failing over to local.
const GROQ_TIMEOUT_MS = 12000
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

// Which provider a request should use. 'local' is explicit; 'auto' means
// Groq with failover; 'groq' is Groq only.
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

async function transcribeGroq(bytes, mimeType, apiKey) {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type: mimeType }), 'dictation.webm')
  form.append('model', GROQ_MODEL)
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
    signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
  })

  if (!response.ok) {
    throw new Error(`Groq API ${response.status}: ${await response.text()}`)
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

export async function transcribe(bytes, mimeType) {
  const provider = providerChoice()
  const apiKey = process.env.GROQ_API_KEY

  if (provider === 'local') return transcribeWhisperCpp(bytes, mimeType)
  if (provider === 'groq') {
    if (!apiKey) throw new Error('GROQ_API_KEY not set (put it in .env or settings)')
    return transcribeGroq(bytes, mimeType, apiKey)
  }

  // 'auto': Groq first, whisper.cpp failover. A missing key skips straight
  // to local — the dictation still works offline.
  if (apiKey) {
    try {
      return await transcribeGroq(bytes, mimeType, apiKey)
    } catch (err) {
      console.error(`[transcribe] Groq failed (${err.message}), trying whisper.cpp`)
    }
  } else {
    console.log('[transcribe] no Groq key, using whisper.cpp')
  }
  return transcribeWhisperCpp(bytes, mimeType)
}
