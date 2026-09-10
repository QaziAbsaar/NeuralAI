// NeuralAir transcription — Phase 1, step 5.
// Provider-agnostic STT interface; current implementation: Groq Whisper API
// (whisper-large-v3-turbo). Swap providers by keeping the same signature.
const GROQ_TRANSCRIBE_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'
const MODEL = 'whisper-large-v3-turbo'

// Tiny .env loader — avoids a dotenv dependency for one file.
// Expects KEY=VALUE lines in <project root>/.env; never overrides real env.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

export async function transcribe(bytes, mimeType) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY not set (put it in .env)')

  const form = new FormData()
  form.append('file', new Blob([bytes], { type: mimeType }), 'dictation.webm')
  form.append('model', MODEL)
  form.append('response_format', 'json')

  const response = await fetch(GROQ_TRANSCRIBE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  })

  if (!response.ok) {
    throw new Error(`Groq API ${response.status}: ${await response.text()}`)
  }

  const data = await response.json()
  return data.text
}
