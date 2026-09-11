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
      scratchpad: typeof raw.scratchpad === 'string' ? raw.scratchpad : '',
    }
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
  delete next.groqApiKey
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2))
  cached = { ...next, groqApiKey: decodeKey(next._groqApiKeyStored) }
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
    transform: s.transform,
    snippets: s.snippets,
    scratchpad: s.scratchpad,
    polishMode: s.polishMode,
    vocabulary: s.vocabulary,
    holdKeycode: s.holdKeycode,
    vad: s.vad,
    hasApiKey: Boolean(s.groqApiKey || process.env.GROQ_API_KEY),
    apiKeySource: s.groqApiKey ? 'settings' : process.env.GROQ_API_KEY ? 'env' : 'none',
  }
}
