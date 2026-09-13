// NeuralAir settings — Phase 3.
// Persistent app settings in userData/settings.json. The Groq API key is
// encrypted at rest with Electron safeStorage (OS keychain-backed where
// available) and base64-encoded in the JSON; everything else is plaintext.
import { app, safeStorage } from 'electron'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'

const DEFAULTS = {
  // Groq API key — stored encrypted, never returned in full to the renderer.
  groqApiKey: '',
  // ISO-639-1 dictation language; empty = Whisper auto-detect.
  language: '',
  // 'polished' = LLM formatting pass, 'exact' = raw transcript only.
  polishMode: 'polished',
  // Names/jargon injected into the polish prompt for correct spellings.
  vocabulary: [],
  // Linux input code for hold-to-talk (e.g. 67 = F9); 0 = off.
  holdKeycode: 0,
  // Groq model for the text-polish LLM pass.
  polishModel: 'openai/gpt-oss-20b',
  // LLM polish provider (Phase 4): 'groq' (default), 'nvidia' (NVIDIA NIM,
  // OpenAI-compatible), 'openai-compatible' (any custom OpenAI-style
  // endpoint — OpenAI, OpenRouter, LM Studio, Ollama), or 'none' (raw
  // transcript only, fully offline pipeline).
  llmProvider: 'groq',
  // Custom endpoint config. Base URL points at the API root that serves
  // /chat/completions (e.g. http://localhost:1234/v1). The 'nvidia' preset
  // fixes this to the NIM endpoint, so the field only matters for
  // 'openai-compatible'.
  llmBaseUrl: '',
  // Stored encrypted, same as the Groq key. Shared by the custom and NVIDIA
  // providers.
  llmApiKey: '',
  llmModel: '',
  // Speech-to-text provider: 'auto' (Groq, fail over to local whisper.cpp),
  // 'groq', 'openai', 'deepgram', 'assemblyai', 'elevenlabs', or 'local'
  // (whisper.cpp only, offline).
  sttProvider: 'auto',
  // STT model name for the providers that offer a choice. Empty = the
  // provider's default (see DEFAULT_STT_MODELS in transcribe.js).
  sttModel: '',
  // Per-provider STT API keys — stored encrypted like the Groq key, so a
  // user can configure several and switch without re-entering them.
  openaiSttKey: '',
  deepgramSttKey: '',
  assemblyaiSttKey: '',
  elevenlabsSttKey: '',
  // Optional explicit paths; default is NeuralAir's install layout under
  // ~/.local/share/neuralair/whisper.cpp/.
  whisperCppPath: '',
  whisperModelPath: '',
  // Output transform applied after polish: none | upper | lower | title.
  transform: 'none',
  // Saved snippets: [{ id, name, text }] — click in the dashboard to copy.
  snippets: [],
  // Free-text scratchpad, autosaved as you type.
  scratchpad: '',
  // VAD auto-stop (toggle mode only).
  vad: { enabled: true, threshold: 0.01, silenceMs: 1500, minMs: 1200 },
}

let cached = null

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json')
}

function encodeKey(plain) {
  if (!plain) return ''
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return 'enc:' + safeStorage.encryptString(plain).toString('base64')
    }
  } catch {
    // fall through to plaintext
  }
  return 'plain:' + plain
}

function decodeKey(stored) {
  if (!stored) return ''
  if (stored.startsWith('enc:')) {
    try {
      return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
    } catch {
      return ''
    }
  }
  if (stored.startsWith('plain:')) return stored.slice(6)
  return '' // unrecognized format
}

export function loadSettings() {
  if (cached) return cached
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'))
    cached = {
      ...DEFAULTS,
      ...raw,
      vad: { ...DEFAULTS.vad, ...(raw.vad ?? {}) },
      vocabulary: Array.isArray(raw.vocabulary) ? raw.vocabulary : [],
      snippets: Array.isArray(raw.snippets) ? raw.snippets : [],
      transform: ['none', 'upper', 'lower', 'title'].includes(raw.transform) ? raw.transform : 'none',
      llmProvider: ['groq', 'nvidia', 'openai-compatible', 'none'].includes(raw.llmProvider) ? raw.llmProvider : 'groq',
      sttProvider: ['auto', 'groq', 'openai', 'deepgram', 'assemblyai', 'elevenlabs', 'local'].includes(raw.sttProvider) ? raw.sttProvider : 'auto',
      scratchpad: typeof raw.scratchpad === 'string' ? raw.scratchpad : '',
    }
    // Decrypt the stored keys for in-process use (they are saved back as
    // encrypted blobs; the plaintext only ever lives in this cache).
    cached.groqApiKey = decodeKey(raw._groqApiKeyStored)
    cached.llmApiKey = decodeKey(raw._llmApiKeyStored)
    cached.openaiSttKey = decodeKey(raw._openaiSttKeyStored)
    cached.deepgramSttKey = decodeKey(raw._deepgramSttKeyStored)
    cached.assemblyaiSttKey = decodeKey(raw._assemblyaiSttKeyStored)
    cached.elevenlabsSttKey = decodeKey(raw._elevenlabsSttKeyStored)
  } catch {
    cached = { ...DEFAULTS, vad: { ...DEFAULTS.vad } }
  }
  return cached
}

export function saveSettings(patch) {
  const current = loadSettings()
  const next = {
    ...current,
    ...patch,
    vad: { ...current.vad, ...(patch.vad ?? {}) },
    vocabulary: Array.isArray(patch.vocabulary) ? patch.vocabulary : current.vocabulary,
  }
  // The API key arrives as plaintext from the renderer; store it encrypted.
  if (patch.groqApiKey !== undefined) {
    next._groqApiKeyStored = encodeKey(patch.groqApiKey)
    next.groqApiKey = ''
  } else if (current._groqApiKeyStored) {
    next._groqApiKeyStored = current._groqApiKeyStored
  }
  // Same treatment for the OpenAI-compatible endpoint key.
  if (patch.llmApiKey !== undefined) {
    next._llmApiKeyStored = encodeKey(patch.llmApiKey)
    next.llmApiKey = ''
  } else if (current._llmApiKeyStored) {
    next._llmApiKeyStored = current._llmApiKeyStored
  }
  // And the per-provider STT keys.
  for (const field of ['openaiSttKey', 'deepgramSttKey', 'assemblyaiSttKey', 'elevenlabsSttKey']) {
    const stored = `_${field}Stored`
    if (patch[field] !== undefined) {
      next[stored] = encodeKey(patch[field])
      next[field] = ''
    } else if (current[stored]) {
      next[stored] = current[stored]
    }
    delete next[field]
  }
  delete next.groqApiKey
  delete next.llmApiKey
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2))
  cached = {
    ...next,
    groqApiKey: decodeKey(next._groqApiKeyStored),
    llmApiKey: decodeKey(next._llmApiKeyStored),
    openaiSttKey: decodeKey(next._openaiSttKeyStored),
    deepgramSttKey: decodeKey(next._deepgramSttKeyStored),
    assemblyaiSttKey: decodeKey(next._assemblyaiSttKeyStored),
    elevenlabsSttKey: decodeKey(next._elevenlabsSttKeyStored),
  }
  return cached
}

export function apiKeyPlain() {
  const key = loadSettings()
  return key.groqApiKey || process.env.GROQ_API_KEY || ''
}

// Live model list for the picker in the sidebar. Chat-capable models only
// (Whisper/embedding models can't run the polish pass). Sorted by id.
export async function listModels() {
  const apiKey = apiKeyPlain()
  if (!apiKey) return []
  try {
    const response = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!response.ok) throw new Error(`Groq API ${response.status}`)
    const data = await response.json()
    return (data.data ?? [])
      .map((m) => m.id)
      .filter((id) => /(^|-)(gpt|llama|qwen|gemma|kimi|moonshot|deepseek|mixtral|mistral|allam)/i.test(id))
      .sort()
  } catch (err) {
    console.error(`[models] list failed: ${err.message}`)
    return []
  }
}

// Push settings into process.env so the pipeline modules (which predate the
// settings system and read env) pick them up without threading a config
// object everywhere. Settings win over .env values.
export function applyToEnv() {
  const s = loadSettings()
  if (s.groqApiKey) process.env.GROQ_API_KEY = s.groqApiKey
  if (s.language) process.env.DICTATION_LANGUAGE = s.language
}

// Safe to hand to the renderer: everything except the key itself, which is
// reduced to a hint of whether one is configured.
export function settingsForRenderer() {
  const s = loadSettings()
  let userName = ''
  try {
    userName = os.userInfo().username
  } catch {
    // stay empty — greeting falls back to a generic one
  }
  return {
    userName,
    language: s.language,
    polishModel: s.polishModel,
    llmProvider: s.llmProvider,
    llmBaseUrl: s.llmBaseUrl,
    llmModel: s.llmModel,
    sttProvider: s.sttProvider,
    sttModel: s.sttModel,
    whisperCppPath: s.whisperCppPath,
    whisperModelPath: s.whisperModelPath,
    hasOpenaiSttKey: Boolean(s.openaiSttKey),
    hasDeepgramSttKey: Boolean(s.deepgramSttKey),
    hasAssemblyaiSttKey: Boolean(s.assemblyaiSttKey),
    hasElevenlabsSttKey: Boolean(s.elevenlabsSttKey),
    transform: s.transform,
    snippets: s.snippets,
    scratchpad: s.scratchpad,
    polishMode: s.polishMode,
    vocabulary: s.vocabulary,
    holdKeycode: s.holdKeycode,
    vad: s.vad,
    hasApiKey: Boolean(s.groqApiKey || process.env.GROQ_API_KEY),
    apiKeySource: s.groqApiKey ? 'settings' : process.env.GROQ_API_KEY ? 'env' : 'none',
    hasLlmKey: Boolean(s.llmApiKey),
  }
}
