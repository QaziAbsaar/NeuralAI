// NeuralAir text injection — Phase 2, step 3.
// Clipboard paste, not per-character typing (Learning 1): write the text to
// the clipboard, simulate one paste keystroke, then restore the user's
// clipboard. On failure the text stays on the clipboard and the user is
// notified — never silently lose a dictation (Learning 5).
//
// Paste strategies, in order:
//   1. nut.js   — macOS, Windows, X11 Linux
//   2. ydotool  — Wayland (uinput-based, works on any compositor; requires
//                 ydotoold running and uinput permissions)
import { clipboard } from 'electron'
import { keyboard, Key } from '@nut-tree-fork/nut-js'
import { execFile } from 'node:child_process'

const CLIPBOARD_RESTORE_DELAY_MS = 500

keyboard.config.autoDelayMs = 10

function ydotoolPaste() {
  // KEY_LEFTCTRL=29, KEY_V=47 — press ctrl, press v, release v, release ctrl.
  return new Promise((resolve) => {
    execFile(
      'ydotool',
      ['key', '29:1', '47:1', '47:0', '29:0'],
      { timeout: 2000 },
      (err) => resolve(!err),
    )
  })
}

async function pasteKeystroke() {
  // 1. nut.js
  try {
    await keyboard.pressKey(Key.LeftControl, Key.V)
    await keyboard.releaseKey(Key.LeftControl, Key.V)
    return true
  } catch {
    // fall through
  }

  // 2. ydotool (Wayland)
  return ydotoolPaste()
}

// Returns true if a paste was fired. NOTE: synthetic keystrokes cannot be
// confirmed delivered — on Wayland without ydotool this reports false and the
// text is left on the clipboard with a notification.
export async function injectText(text, notify) {
  const savedClipboard = clipboard.readText()
  clipboard.writeText(text)

  const pasted = await pasteKeystroke()
  if (!pasted) {
    notify?.('NeuralAir could not paste — your text is on the clipboard.')
    return false
  }

  // Give the target app a moment to read the clipboard, then restore it.
  setTimeout(() => clipboard.writeText(savedClipboard), CLIPBOARD_RESTORE_DELAY_MS)
  return true
}
