// NeuralAir active-window context — Phase 2, step 1.
// Returns the focused window's title/owner at hotkey release (Learning 4:
// context is grabbed at release time, not press time).
//
// No cross-Compositor way to do this on Wayland — each path is tried in turn:
//   1. active-win   — macOS, Windows, X11 Linux
//   2. swaymsg      — sway
//   3. hyprctl      — Hyprland
//   4. i3-msg       — i3 (X11, but active-win may miss it)
//   5. kdotool      — KDE Plasma (kwin_wayland)
// If none work (e.g. COSMIC, which exposes no CLI for the foreign-toplevel
// protocols), returns null and the LLM prompt degrades gracefully to a
// context-free variant.
import activeWin from 'active-win'
import { execFile } from 'node:child_process'

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 2000 }, (err, stdout) => {
      resolve(err ? null : stdout)
    })
  })
}

// Walk a sway tree looking for the focused node.
function findFocusedSwayNode(node) {
  if (!node || typeof node !== 'object') return null
  if (node.focused && node.name) return node
  for (const child of node.nodes ?? []) {
    const found = findFocusedSwayNode(child)
    if (found) return found
  }
  for (const child of node.floating_nodes ?? []) {
    const found = findFocusedSwayNode(child)
    if (found) return found
  }
  return null
}

export async function getActiveWindowContext() {
  // 1. active-win — macOS, Windows, X11.
  try {
    const win = await activeWin()
    if (win?.title) {
      return { title: win.title, owner: win.owner?.name ?? '' }
    }
  } catch {
    // Expected on Wayland — falls through to compositor helpers.
  }

  // 2. swaymsg — sway.
  const swayTree = await run('swaymsg', ['-r', '-t', 'get_tree'])
  if (swayTree) {
    try {
      const focused = findFocusedSwayNode(JSON.parse(swayTree))
      if (focused?.name) {
        return { title: focused.name, owner: focused.app_properties?.class ?? '' }
      }
    } catch {
      // fall through
    }
  }

  // 3. hyprctl — Hyprland.
  const hypr = await run('hyprctl', ['-j', 'activewindow'])
  if (hypr) {
    try {
      const win = JSON.parse(hypr)
      if (win?.title) return { title: win.title, owner: win.class ?? '' }
    } catch {
      // fall through
    }
  }

  // 4. i3-msg — i3. Same tree format as sway.
  const i3Tree = await run('i3-msg', ['-t', 'get_tree'])
  if (i3Tree) {
    try {
      const focused = findFocusedSwayNode(JSON.parse(i3Tree))
      if (focused?.name) {
        return { title: focused.name, owner: focused.window_properties?.class ?? '' }
      }
    } catch {
      // fall through
    }
  }

  // 5. kdotool — KDE Plasma. Two calls: window id, then its name.
  const kwinId = await run('kdotool', ['getactivewindow'])
  if (kwinId?.trim()) {
    const name = await run('kdotool', ['getwindowname', kwinId.trim()])
    if (name?.trim()) return { title: name.trim(), owner: '' }
  }

  return null
}
