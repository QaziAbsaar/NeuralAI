// Local STT module test — runs electron/transcribe.js inside Electron
// (settings.js imports electron), pipes an audio file through the local
// whisper.cpp provider, prints the transcript, exits.
//
//   ./node_modules/.bin/electron scripts/test-local-stt.mjs [audio-file] [mode]
//
// Mode: 'local' (default) forces the local provider; 'failover' uses 'auto'
// with a bogus Groq key and must still transcribe via the whisper.cpp
// fallback. Defaults to whisper.cpp's bundled jfk sample if installed.
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv, transcribe } from '../electron/transcribe.js'
import { loadSettings, saveSettings } from '../electron/settings.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.whenReady().then(async () => {
  try {
    loadEnv()
    const input =
      process.argv[2] ||
      path.join(process.env.HOME || '', '.local/share/neuralair/whisper.cpp/samples/jfk.wav')
    const mode = process.argv[3] || 'local'
    const bytes = fs.readFileSync(input)
    // Wrap raw wav/pcm in a webm container the way MediaRecorder produces —
    // proves the ffmpeg decode path, not just raw WAV passthrough.
    const { execFileSync } = await import('node:child_process')
    const webm = execFileSync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-i', input,
      '-c:a', 'libopus', '-b:a', '32k', '-f', 'webm', 'pipe:1',
    ])

    if (mode === 'failover') {
      saveSettings({ sttProvider: 'auto' })
      process.env.GROQ_API_KEY = 'gsk_invalid_key_for_failover_test'
    } else {
      saveSettings({ sttProvider: 'local' })
    }
    console.log(`[test] provider: ${loadSettings().sttProvider}${mode === 'failover' ? ' (auto, bogus Groq key)' : ''}, input: ${input} (${webm.length} bytes webm)`)

    const text = await transcribe(new Uint8Array(webm), 'audio/webm')
    console.log(`[test] ${mode.toUpperCase()} RESULT:`, JSON.stringify(text))
  } catch (err) {
    console.error('[test] FAILED:', err.message)
    process.exitCode = 1
  } finally {
    app.quit()
  }
})
