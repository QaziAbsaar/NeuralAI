// NeuralAir active-window context — Phase 2, step 1.
// Returns the focused window's title/owner at hotkey release (Learning 4:
// context is grabbed at release time, not press time).
//
// No cross-Compositor way to do this on Wayland — each path is tried in turn:
//   1. active-win   — macOS, Windows, X11 Linux
//   2. swaymsg      — sway/i3 (wlroots)
//   3. hyprctl      — Hyprland
// If none work (e.g. COSMIC today), returns null and the LLM prompt degrades
// gracefully to a context-free variant.
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

  // 2. swaymsg — sway/i3.
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

  return null
}
