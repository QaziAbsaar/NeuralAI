// NeuralAir dictation history — Phase 2 stretch.
// In-memory ring of the last dictations, powering "scratch that" (undo).
// Entries persist until quit; persistence arrives with the Phase 3 settings
// work if it proves useful.
const MAX_ENTRIES = 50

const entries = []

export function recordDictation(entry) {
  entries.push(entry)
  if (entries.length > MAX_ENTRIES) entries.shift()
}

export function popDictation() {
  return entries.pop() ?? null
}
