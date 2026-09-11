// NeuralAir recording indicator — Phase 4 polish.
// A tiny frameless, transparent, always-on-top window pinned to the
// bottom-right corner of the screen while dictation is active. The renderer
// inside it (`?window=indicator`) draws a pulsing sage dot; this module only
// owns the window and its placement.
import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SIZE = 56 // window size in px — the dot and its glow pulse live inside
const MARGIN = 24 // distance from the screen corner

let indicatorWin = null

// Bottom-right of the primary display's work area, so it never sits under
// a dock/taskbar.
function cornerPosition() {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: workArea.x + workArea.width - SIZE - MARGIN,
    y: workArea.y + workArea.height - SIZE - MARGIN,
  }
}

export function showIndicator() {
  if (indicatorWin && !indicatorWin.isDestroyed()) {
    const { x, y } = cornerPosition()
    indicatorWin.setPosition(x, y)
    indicatorWin.showInactive()
    return
  }
  const { x, y } = cornerPosition()
  indicatorWin = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    x,
    y,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    focusable: false, // never steal focus from the window being dictated into
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })
  // Dock-level pin (macOS); harmless elsewhere.
  indicatorWin.setAlwaysOnTop(true, 'floating')
  if (process.env.VITE_DEV_SERVER_URL) {
    indicatorWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}?window=indicator`)
  } else {
    indicatorWin.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
      query: { window: 'indicator' },
    })
  }
  // showInactive: visible without taking focus even on first show.
  indicatorWin.once('ready-to-show', () => {
    if (indicatorWin && !indicatorWin.isDestroyed()) {
      indicatorWin.showInactive()
      console.log('[indicator] shown')
    }
  })
  indicatorWin.on('closed', () => {
    indicatorWin = null
  })
  // Click-through: the indicator is informational only. A fully transparent
  // window region would already pass clicks through; this makes the whole
  // window ignore the pointer even over the dot.
  indicatorWin.setIgnoreMouseEvents(true)
}

export function hideIndicator() {
  if (indicatorWin && !indicatorWin.isDestroyed()) indicatorWin.hide()
}
