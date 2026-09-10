// NeuralAir hotkey module — Phase 1, step 3.
// Toggle recording via a global shortcut. Pure Electron — no native deps.
//
// NOTE: Electron's globalShortcut fires on keydown only (no keyup), so true
// push-to-talk (hold-to-record) is not possible here. Hold semantics need a
// global key hook (uiohook-napi, or nut.js's keyboard hook in Phase 2).
// For now: toggle mode — press to start, press again to stop.
import { globalShortcut } from 'electron'

export function registerHotkey(accelerator, onToggle) {
  let recording = false

  const ok = globalShortcut.register(accelerator, () => {
    recording = !recording
    onToggle(recording)
  })

  if (!ok) {
    console.error(`Failed to register hotkey: ${accelerator} (already taken?)`)
    return false
  }
  return true
}

export function unregisterAllHotkeys() {
  globalShortcut.unregisterAll()
}
