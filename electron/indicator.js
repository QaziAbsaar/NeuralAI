// NeuralAir recording indicator / HUD pill.
// A small frameless, transparent, always-on-top window pinned to the
// top-center of the screen while a dictation is in flight. The renderer
// inside it (`?window=indicator`) draws a pill with a pulsing dot, a live
// mic-level bar, and the pipeline stage (listening → transcribing →
// polishing → done); this module owns the window, its placement, and the
// send channel main uses to feed it.
import { BrowserWindow, screen } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const WIDTH = 300 // pill width — dot + level bar + stage label
const HEIGHT = 44
const MARGIN = 24 // distance from the top edge

let indicatorWin = null

// Top-center of the primary display's work area — visible from anywhere
// without covering content low on the screen.
function topCenterPosition() {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    x: workArea.x + Math.round((workArea.width - WIDTH) / 2),
    y: workArea.y + MARGIN,
  }
}

export function showIndicator() {
  if (indicatorWin && !indicatorWin.isDestroyed()) {
    const { x, y } = topCenterPosition()
    indicatorWin.setPosition(x, y)
    indicatorWin.showInactive()
    return
  }
  const { x, y } = topCenterPosition()
  indicatorWin = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    x,
    y,
    frame: false,
    transparent: true,
    // Fully transparent ARGB background — without this the compositor paints
    // the window's default background (the accent-colored box) behind the pill.
    backgroundColor: '#00000000',
    roundedCorners: false,
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
  // Click-through: the pill is informational only. A fully transparent
  // window region would already pass clicks through; this makes the whole
  // window ignore the pointer even over the pill.
  indicatorWin.setIgnoreMouseEvents(true)
}

export function hideIndicator() {
  if (indicatorWin && !indicatorWin.isDestroyed()) indicatorWin.hide()
}

// Push a message to the pill's renderer; no-op when it isn't open.
export function sendToIndicator(channel, payload) {
  if (indicatorWin && !indicatorWin.isDestroyed()) {
    indicatorWin.webContents.send(channel, payload)
  }
}
