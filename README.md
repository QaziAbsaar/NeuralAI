# NeuralAir

Free, open-source, privacy-first alternative to Wispr Flow. Voice dictation and AI transcription desktop app.

- **Zero weekly limits** — Bring-Your-Own-Key model (Groq API).
- **Privacy-first** — No screen recording, no telemetry.
- **Offline-ready (planned)** — Local `whisper.cpp` fallback.

## Core Loop

Hold a global hotkey → speak → release → audio is transcribed with Whisper → text is polished by an LLM using the active window as context → text is typed into the active window.

## Development

```bash
npm install
npm run dev      # Vite dev server + Electron
```

## Build

```bash
npm run dist     # Packages installers via electron-builder
```

See `CLAUDE.md` for the full architectural briefing and roadmap.
