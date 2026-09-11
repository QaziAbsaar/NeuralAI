<p align="center">
  <img src="Logo.png" alt="NeuralAir logo" width="256" />
</p>

Free, open-source, privacy-first alternative to Wispr Flow. Voice dictation and AI transcription desktop app.

- **Zero weekly limits** — Bring-Your-Own-Key model (Groq API).
- **Privacy-first** — No screen recording, no telemetry, audio never touches disk.
- **Offline-ready (planned)** — Local `whisper.cpp` fallback.

## Core Loop

Hold a global hotkey → speak → release → audio is transcribed with Whisper → text is polished by an LLM using the active window as context → text is typed into the active window.

## Features

- Background-only app: lives in the system tray, no windows.
- In-memory audio capture — dictations never write temp files to disk.
- Fast transcription via Groq `whisper-large-v3-turbo`, with the dictation language pinned to stop Whisper guessing wrong languages.
- LLM text polish (punctuation, filler-word removal) — any failure falls back to the raw transcript.
- Text injection via clipboard + single paste, with your clipboard saved and restored afterwards.
- **Toggle mode** with **VAD auto-stop**: tap the key, speak, stop talking — silence ends the recording (~1.5s).
- **Hold-to-talk**: hold a key while speaking, release to stop.
- **"Scratch that"**: undo the last dictation (backspaces it out, restores your clipboard).
- Dictation history (last 100), persisted across restarts.
- Recording status in the tray.
- Works on X11 and Wayland.

## Settings window

Open **Settings** from the tray icon. The window has three parts:

- **Sidebar** — words-today counter, the model picker (lists every chat model available on your Groq account; the chosen one runs the polish pass), and navigation.
- **Main feed** — your dictation history grouped by day, with copy buttons, and a floating mic button to start/stop a dictation without touching a hotkey.
- **Status card** — agent status, words/wpm/day-streak stats, voice-profile progress.

Other views, all wired to real settings: **Insights** (words per day), **Dictionary** (custom vocabulary fed to the polish prompt), **Snippets** (click-to-copy text blocks), **Style** (AI polished vs exact transcription), **Transforms** (output casing), **Scratchpad** (autosaved free text).

The Groq API key can be stored in the settings window — encrypted at rest with your OS keychain (`safeStorage`), overriding `.env`.

## Setup

1. Get a Groq API key from [console.groq.com/keys](https://console.groq.com/keys).
2. Create a `.env` file in the project root:
   ```
   GROQ_API_KEY=your_key_here
   DICTATION_LANGUAGE=en
   ```
   `DICTATION_LANGUAGE` is an optional ISO-639-1 code (e.g. `en`, `is`, `ur`). Unset = auto-detect, which can hallucinate the wrong language on short, context-free speech.
3. Install and run:
   ```bash
   npm install
   npm run dev
   ```

## Usage

### Toggle mode

`Ctrl+Space` (X11/macOS/Windows), or bind the command below to a key in your desktop's shortcut settings (recommended on Wayland/GNOME/COSMIC):
```
./node_modules/.bin/electron . --toggle
```
Tap once to start, again to stop — or just stop talking: VAD auto-stop ends the recording after ~1.5s of silence.

### Hold-to-talk (optional)

Set `HOLD_KEYCODE` in `.env` to a Linux input code (e.g. `67` = F9, `87` = F11):
```
HOLD_KEYCODE=67
```
Hold that key while speaking; release to stop. The app reads the key directly from the keyboard, so do **not** also bind it in your desktop's shortcut settings. Pick a key that types nothing on its own (a function key, not a letter).

### Scratch that

Undo the last dictation — bind this command to a key (e.g. `Ctrl+Shift+Backspace`), or use the tray menu:
```
./node_modules/.bin/electron . --scratch
```
It backspaces out the last injected text and restores the clipboard that was there before the dictation. Works best right after a dictation, with the cursor still where the text landed.

### Tunables (optional, in `.env`)

| Variable | Default | Effect |
|---|---|---|
| `VAD_THRESHOLD` | `0.01` | Silence loudness threshold (lower = more sensitive) |
| `VAD_SILENCE_MS` | `1500` | Silence duration before auto-stop |
| `NEURALAIR_NO_VAD` | unset | Set to `1` to disable auto-stop |

## Build

```bash
npm run dist:linux   # AppImage + .deb
npm run dist:win     # NSIS installer — requires wine on Linux
npm run dist:mac     # .dmg — must run on macOS
```

Packages land in `release/`.

## License

MIT
