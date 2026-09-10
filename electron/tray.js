// NeuralAir tray module — Phase 1, step 2.
// Minimal tray presence: status item + quit. Hotkey/audio modules (steps 3-4)
// will call setStatus() to flip the icon between idle and recording.
import { Menu, Tray, nativeImage } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const ICONS = {
  idle: path.join(__dirname, '..', 'assets', 'tray-idle.png'),
  recording: path.join(__dirname, '..', 'assets', 'tray-recording.png'),
}

// Placeholder colors — swapped when the user supplies the color palette.
const LABELS = {
  idle: 'NeuralAir — Idle',
  recording: 'NeuralAir — Recording…',
}

let tray = null
let statusItem = null

export function createTray(onQuit, onToggle) {
  tray = new Tray(nativeImage.createFromPath(ICONS.idle))

  statusItem = { label: LABELS.idle, enabled: false }
  const menu = Menu.buildFromTemplate([
    statusItem,
    { type: 'separator' },
    { label: 'Toggle recording', click: onToggle },
    { label: 'Quit', click: onQuit },
  ])

  tray.setContextMenu(menu)
  tray.setToolTip(LABELS.idle)
  return tray
}

export function setStatus(status) {
  if (!tray || !ICONS[status]) return
  tray.setImage(nativeImage.createFromPath(ICONS[status]))
  tray.setToolTip(LABELS[status])
  if (statusItem) statusItem.label = LABELS[status]
}
