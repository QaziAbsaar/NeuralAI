// NeuralAir text injection — Phase 2, step 3.
// Clipboard paste, not per-character typing (Learning 1): write the text to
// the clipboard, simulate one paste keystroke, then restore the user's
// clipboard. On failure the text stays on the clipboard and the user is
// notified — never silently lose a dictation (Learning 5).
//
// Wayland caveat (found the hard way): Electron's clipboard module writes to
// the X11 clipboard, which does NOT propagate to the Wayland clipboard on
// COSMIC — Wayland-native apps kept pasting the user's old clipboard content.
// So on Wayland we shell out to wl-clipboard (wl-copy/wl-paste) instead, and
// prefer ydotool for the paste keystroke since nut.js's XTest events do not
// reach Wayland-native windows.
//
// Paste strategies, in order:
//   1. ydotool (Wayland) — uinput-based, works on any compositor; requires
//      ydotoold running and uinput permissions
//   2. nut.js            — macOS, Windows, X11 Linux
import { clipboard } from 'electron'
import { keyboard, Key } from '@nut-tree-fork/nut-js'
import { execFile } from 'node:child_process'

const isWayland = Boolean(process.env.WAYLAND_DISPLAY)

// Restore delay: must exceed the slowest app's clipboard read after paste,
// but short enough that the user's clipboard comes back promptly. A manual
// Ctrl+V after a dictation should paste the user's last copied item.
const CLIPBOARD_RESTORE_DELAY_MS = 2000

keyboard.config.autoDelayMs = 10

// Run a helper command; resolves stdout on success, null on failure.
function run(cmd, args, stdin) {
  return new Promise((resolve) => {
    const child = execFile(cmd, args, { timeout: 2000 }, (err, stdout) =>
      resolve(err ? null : stdout),
    )
    if (stdin !== undefined) child.stdin.end(stdin)
  })
}

async function readClipboard() {
  if (isWayland) {
    const text = await run('wl-paste', ['--no-newline'])
    if (text !== null) return text
  }
  return clipboard.readText()
}

export async function writeClipboard(text) {
  if (isWayland) {
    // wl-copy reads stdin and forks to the background to serve the selection.
    const result = await run('wl-copy', [], text)
    if (result !== null) return
  }
  clipboard.writeText(text)
}

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
  // 1. ydotool on Wayland — reaches Wayland-native windows
  if (isWayland && (await ydotoolPaste())) return true

  // 2. nut.js — macOS, Windows, X11 Linux (also XWayland targets)
  try {
    await keyboard.pressKey(Key.LeftControl, Key.V)
    await keyboard.releaseKey(Key.LeftControl, Key.V)
    return true
  } catch {
    // fall through
  }

  // 3. ydotool as a last resort even off-Wayland
  return ydotoolPaste()
}

// Returns the clipboard content that was saved before the paste (for
// history/undo) on success, or false if no paste could be fired. NOTE:
// synthetic keystrokes cannot be confirmed delivered — if every strategy
// fails this returns false and the text is left on the clipboard with a
// notification.
export async function injectText(text, notify) {
  const savedClipboard = await readClipboard()
  await writeClipboard(text)

  const pasted = await pasteKeystroke()
  if (!pasted) {
    notify?.('NeuralAir could not paste — your text is on the clipboard.')
    return false
  }

  // Give the target app a moment to read the clipboard, then restore it.
  setTimeout(() => {
    writeClipboard(savedClipboard).catch(() => {})
  }, CLIPBOARD_RESTORE_DELAY_MS)
  return savedClipboard
}

// "Scratch that" support — delete the last n characters before the cursor.
// KEY_BACKSPACE = 14 on Linux.
export async function backspaceChars(n) {
  if (n <= 0) return true
  if (isWayland) {
    const seq = []
    for (let i = 0; i < n; i++) seq.push('14:1', '14:0')
    if ((await run('ydotool', ['key', ...seq])) !== null) return true
  }
  try {
    for (let i = 0; i < n; i++) {
      await keyboard.pressKey(Key.Backspace)
      await keyboard.releaseKey(Key.Backspace)
    }
    return true
  } catch {
    return false
  }
}
