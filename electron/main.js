// NeuralAir main process.
// Background-only app: no visible window. Tray (step 2) + hotkey (step 3).
import { app, BrowserWindow } from 'electron'
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

// Hidden renderer window. Audio capture (MediaRecorder) will live here in Phase 1, step 4.
function createHiddenRenderer() {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  loadRenderer(win)
  return win
}

app.whenReady().then(() => {
  createHiddenRenderer()
  createTray(() => app.quit())

  const HOTKEY = 'Control+Space'
  registerHotkey(HOTKEY, (recording) => {
    setStatus(recording ? 'recording' : 'idle')
    // Phase 1, step 4: start/stop MediaRecorder in the hidden renderer here.
    console.log(recording ? '[recording] start' : '[recording] stop')
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
