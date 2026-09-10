<img src="Logo.png" alt="NeuralAir logo" align="left" width="96" />

# NeuralAir

Free, open-source, privacy-first alternative to Wispr Flow. Voice dictation and AI transcription desktop app.

- **Zero weekly limits** — Bring-Your-Own-Key model (Groq API).
- **Privacy-first** — No screen recording, no telemetry, audio never touches disk.
- **Offline-ready (planned)** — Local `whisper.cpp` fallback.

## Core Loop

Hold a global hotkey → speak → release → audio is transcribed with Whisper → text is polished by an LLM using the active window as context → text is typed into the active window.

## Features

- Background-only app: lives in the system tray, no windows.
- In-memory audio capture — dictations never write temp files to disk.
- Fast transcription via Groq `whisper-large-v3-turbo`.
- Recording status in the tray.
- Works on X11 and Wayland (on Wayland, bind the toggle command to a key in your desktop's shortcut settings).

## Setup

1. Get a Groq API key from [console.groq.com/keys](https://console.groq.com/keys).
2. Create a `.env` file in the project root:
   ```
   GROQ_API_KEY=your_key_here
   ```
3. Install and run:
   ```bash
   npm install
   npm run dev
   ```

## Usage

- Toggle recording: `Ctrl+Space` (X11/macOS/Windows), or bind the command below to a key in your desktop's shortcut settings (recommended on Wayland/GNOME/COSMIC):
  ```
  ./node_modules/.bin/electron . --toggle
  ```
- The transcript is printed to the console (text injection into the active window arrives in Phase 2).

## Build

```bash
npm run dist
```

## License

MIT
