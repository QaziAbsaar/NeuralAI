// NeuralAir main process.
// Background-only app: no visible window. Tray (step 2) + hotkey (step 3)
// + in-memory audio capture via hidden renderer (step 4).
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTray, setStatus } from './tray.js'
import { registerHotkey, unregisterAllHotkeys } from './hotkey.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
  const hiddenWin = createHiddenRenderer()
  createTray(() => app.quit())

  const HOTKEY = 'Control+Space'
  registerHotkey(HOTKEY, (recording) => {
    setStatus(recording ? 'recording' : 'idle')
    if (hiddenWin.isDestroyed()) return
    hiddenWin.webContents.send(recording ? 'recorder:start' : 'recorder:stop')
  })

  // Audio arrives from the renderer as raw bytes — stays in memory only.
  // Phase 1, step 5 forwards this buffer to the Groq Whisper API.
  ipcMain.on('recorder:audio', (_event, bytes, mimeType) => {
    console.log(`[recorder] captured ${bytes.byteLength} bytes (${mimeType}) in memory`)
  })

  // Keep running in the background when windows close — this is a tray app.
  // Subscribing (even as a no-op) overrides Electron's default quit-on-all-closed.
  app.on('window-all-closed', () => {})
})

app.on('will-quit', () => {
  unregisterAllHotkeys()
})

// macOS: clicking the dock icon should not spawn a visible window.
app.on('activate', () => {})
