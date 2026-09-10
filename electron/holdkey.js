// NeuralAir hold-to-talk key listener — Phase 2 stretch.
// Wayland global shortcuts (and Electron's globalShortcut, which uses X11
// grabs) only fire on key press — release events are unreachable through
// them. To support hold-to-talk (press = record, release = stop), this module
// reads raw evdev events from /dev/input/event* and watches a single
// configured keycode.
//
// Implementation note: fs.createReadStream does NOT work on evdev devices —
// it stats the char device (size 0) and never emits data. Verified against
// `dd`, which reads the same devices fine. So this uses fs.read on a raw
// blocking fd; the async callback form runs the wait on libuv's threadpool,
// leaving the Electron main loop free.
//
// Access: /dev/input/event* is readable by the active seat user via
// systemd-logind ACLs on modern distros (uaccess).
//
// Device selection: only nodes with a "kbd" handler in /proc/bus/input/devices
// are opened. Reading every event node would park a blocking read on each —
// more than libuv's threadpool can serve, and idle devices (lid switch, mice)
// would starve the keyboard's read. With just the keyboard nodes (typically
// 1-3) the default pool handles everything.
//
// Privacy: these streams contain every keypress on every keyboard. This
// module parses each event and acts ONLY on the configured keycode — all
// other events are discarded immediately, never stored, never logged.
import fs from 'node:fs'

const EV_KEY = 0x01
// struct input_event on 64-bit Linux: timeval (16) + type u16 + code u16 + value s32
const EVENT_SIZE = 24

function keyboardEventNodes() {
  try {
    const devices = fs.readFileSync('/proc/bus/input/devices', 'utf8')
    const nodes = []
    let current = null
    for (const line of devices.split('\n')) {
      if (line.startsWith('N: Name=')) current = line
      // "H: Handlers=sysrq kbd event3 leds" — keyboard if it has the kbd handler
      if (line.startsWith('H: Handlers=') && /\bkbd\b/.test(line)) {
        const events = line.match(/event\d+/g) ?? []
        for (const e of events) nodes.push({ node: `/dev/input/${e}`, name: current })
      }
    }
    return nodes
  } catch {
    return []
  }
}

export function startHoldKeyListener(keycode, onPress, onRelease) {
  const keyboards = keyboardEventNodes()
  let opened = 0
  for (const { node } of keyboards) {
    let fd
    try {
      fd = fs.openSync(node, 'r')
    } catch {
      continue // no ACL for this device — the keyboard may be on another node
    }
    opened++
    watchDevice(fd, keycode, onPress, onRelease)
  }
  return opened > 0
}

// One read loop per device fd. Blocks a threadpool thread between events,
// which is fine — the pool has several and each device is mostly idle.
function watchDevice(fd, keycode, onPress, onRelease) {
  const buf = Buffer.alloc(EVENT_SIZE)
  const readNext = () => {
    fs.read(fd, buf, 0, EVENT_SIZE, null, (err, bytesRead) => {
      if (err) console.error(`[holdkey] read failed: ${err.message}`)
      if (err || bytesRead < EVENT_SIZE) {
        try {
          fs.closeSync(fd)
        } catch {
          // already closed
        }
        return
      }
      const type = buf.readUInt16LE(16)
      const code = buf.readUInt16LE(18)
      const value = buf.readInt32LE(20)
      if (type === EV_KEY && code === keycode) {
        if (value === 1) onPress()
        else if (value === 0) onRelease()
        // value 2 = auto-repeat while held — ignored
      }
      readNext()
    })
  }
  readNext()
}
