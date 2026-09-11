// NeuralAir dictation history — Phase 2 stretch, persisted in Phase 3.
// Ring of recent dictations powering both "scratch that" (undo, in-memory
// clipboard state) and the dashboard's activity feed (userData/history.json).
// The pre-dictation clipboard snapshot stays in memory only — it is useless
// after a restart and has no business on disk.
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const MAX_ENTRIES = 100

const entries = [] // in-memory, includes clipboardBefore for scratch
let nextId = 1

function historyPath() {
  return path.join(app.getPath('userData'), 'history.json')
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(historyPath(), 'utf8'))
    if (Array.isArray(raw)) entries.push(...raw.slice(-MAX_ENTRIES))
  } catch {
    // no history yet
  }
  nextId = entries.reduce((max, e) => Math.max(max, e.id ?? 0), 0) + 1
}

function persist() {
  // Strip the clipboard snapshot — memory-only by design.
  const onDisk = entries.map(({ clipboardBefore, ...rest }) => rest)
  fs.writeFileSync(historyPath(), JSON.stringify(onDisk, null, 2))
}

export function recordDictation(entry) {
  if (entries.length === 0) load()
  entries.push({ id: nextId++, ...entry })
  if (entries.length > MAX_ENTRIES) entries.shift()
  persist()
}

export function popDictation() {
  if (entries.length === 0) load()
  const entry = entries.pop()
  if (entry) persist()
  return entry ?? null
}

// Activity feed: newest first, clipboard snapshots stripped.
export function listHistory(limit = MAX_ENTRIES) {
  if (entries.length === 0) load()
  return entries
    .slice()
    .reverse()
    .slice(0, limit)
    .map(({ clipboardBefore, ...rest }) => rest)
}

export function deleteDictation(id) {
  if (entries.length === 0) load()
  const idx = entries.findIndex((e) => e.id === id)
  if (idx === -1) return false
  entries.splice(idx, 1)
  persist()
  return true
}
