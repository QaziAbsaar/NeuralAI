// NeuralAir main process — Phase 1, step 1.
// Background-only app: no visible window. Tray icon + global hotkey come in later steps.
import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

  // Keep running in the background when windows close — this is a tray app.
  // Subscribing (even as a no-op) overrides Electron's default quit-on-all-closed.
  app.on('window-all-closed', () => {})
})

// macOS: clicking the dock icon should not spawn a visible window.
app.on('activate', () => {})
