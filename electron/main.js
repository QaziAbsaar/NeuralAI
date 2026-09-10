// NeuralAir main process.
// Background-only app: no visible window. Tray (step 2) + hotkey (step 3)
// + in-memory audio capture via hidden renderer (step 4) + Groq Whisper
// transcription (step 5).
//
// Hotkey strategy: Electron's globalShortcut uses X11 key grabs, which do not
// deliver events on Wayland (COSMIC). So toggling works two ways:
//   1. globalShortcut — works on X11/macOS/Windows.
//   2. Single-instance toggle — launch `neuralair --toggle`; the new process
//      signals the running instance via 'second-instance' and exits. Bind this
//      command to a key in the desktop's own shortcut settings (e.g. COSMIC
//      Settings → Keyboard → Shortcuts), which is Wayland-native and reliable.
import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTray, setStatus } from './tray.js'
import { registerHotkey, unregisterAllHotkeys } from './hotkey.js'
import { loadEnv, transcribe } from './transcribe.js'
import { getActiveWindowContext } from './context.js'
import { polishTranscript } from './polish.js'
import { injectText } from './inject.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Toggle invoked from a second instance ("--toggle") — wired up after ready.
let toggleRecording = () => {}

const gotInstanceLock = app.requestSingleInstanceLock()
if (!gotInstanceLock) {
  // A running instance already holds the lock; it received our args via
  // 'second-instance'. Nothing left for this process to do.
  app.quit()
}

// Load the renderer from the Vite dev server in dev, or from the build output in prod.
function loadRenderer(win) {
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

// Hidden renderer window. Hosts the MediaRecorder-based audio capture.
function createHiddenRenderer() {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })
  loadRenderer(win)
  return win
}

app.whenReady().then(() => {
  if (!gotInstanceLock) return // second instance exiting — do not initialize

  loadEnv()
  console.log('[main] app ready')
  const hiddenWin = createHiddenRenderer()

  // Forward renderer console output to the main terminal — the hidden window
  // has no devtools in normal use, so this is the only way to see its logs.
  hiddenWin.webContents.on('console-message', (event) => {
    console.log(`[renderer] ${event.message}`)
  })
  hiddenWin.webContents.once('did-finish-load', () => {
    console.log('[main] renderer loaded')
  })

  let recording = false
  toggleRecording = () => {
    recording = !recording
    console.log(`[main] toggle -> ${recording ? 'recording' : 'idle'}`)
    setStatus(recording ? 'recording' : 'idle')
    if (hiddenWin.isDestroyed()) return
    hiddenWin.webContents.send(recording ? 'recorder:start' : 'recorder:stop')
  }

  createTray(() => app.quit(), toggleRecording)

  const HOTKEY = 'Control+Space'
  const ok = registerHotkey(HOTKEY, toggleRecording)
  console.log(`[main] hotkey ${HOTKEY} registered: ${ok}`)

  // Diagnostic self-test: NEURALAIR_AUTOTEST=1 triggers a 3s recording after
  // load, bypassing the hotkey. Verifies the recorder pipeline independently
  // of globalShortcut/Wayland issues.
  if (process.env.NEURALAIR_AUTOTEST) {
    hiddenWin.webContents.once('did-finish-load', () => {
      setTimeout(toggleRecording, 1000)
      setTimeout(toggleRecording, 4000)
    })
  }

  // Full pipeline: audio bytes → transcript → window context → LLM polish →
  // paste at cursor. Autotest mode stops before injection so automated runs
  // don't paste into whatever happens to be focused.
  ipcMain.on('recorder:audio', async (_event, bytes, mimeType) => {
    console.log(`[recorder] captured ${bytes.byteLength} bytes (${mimeType}) in memory`)
    try {
      const transcript = await transcribe(bytes, mimeType)
      console.log(`[transcript] ${transcript}`)
      if (!transcript.trim()) return

      const context = await getActiveWindowContext()
      console.log(`[context] ${context ? `${context.owner}: ${context.title}` : 'none (Wayland/COSMIC or unsupported)'}`)

      const polished = await polishTranscript(transcript, context)
      console.log(`[polished] ${polished}`)

      if (process.env.NEURALAIR_AUTOTEST) {
        console.log('[inject] skipped (autotest)')
        return
      }
      const ok = await injectText(polished, (msg) => {
        if (Notification.isSupported()) new Notification({ body: msg }).show()
      })
      console.log(`[inject] ${ok ? 'pasted' : 'failed — text left on clipboard'}`)
    } catch (err) {
      console.error(`[pipeline] failed: ${err.message}`)
    }
  })

  // Keep running in the background when windows close — this is a tray app.
  // Subscribing (even as a no-op) overrides Electron's default quit-on-all-closed.
  app.on('window-all-closed', () => {})
})

// Second instance launched with --toggle: flip recording in the live instance.
app.on('second-instance', (_event, argv) => {
  if (argv.includes('--toggle')) toggleRecording()
})

app.on('will-quit', () => {
  unregisterAllHotkeys()
})

// macOS: clicking the dock icon should not spawn a visible window.
app.on('activate', () => {})
