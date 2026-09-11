// NeuralAir usage tracking — Phase 3.
// Per-day dictation counts, audio seconds, and word counts, plus a rough cost
// estimate for the BYOK model (Groq pricing: whisper-large-v3-turbo ≈ $0.04
// per hour of audio; the polish model's cost is negligible at these sizes).
import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const COST_PER_AUDIO_HOUR = 0.04

function usagePath() {
  return path.join(app.getPath('userData'), 'usage.json')
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(usagePath(), 'utf8'))
  } catch {
    return {}
  }
}

export function recordUsage(audioSeconds, wordCount = 0) {
  const all = readAll()
  const day = all[todayKey()] ?? { dictations: 0, audioSeconds: 0, words: 0 }
  day.dictations += 1
  day.audioSeconds += Math.max(0, Math.round(audioSeconds))
  day.words += Math.max(0, wordCount)
  all[todayKey()] = day
  // Keep the last 30 days.
  const days = Object.keys(all).sort().slice(-30)
  const trimmed = {}
  for (const d of days) trimmed[d] = all[d]
  fs.writeFileSync(usagePath(), JSON.stringify(trimmed, null, 2))
}

// Consecutive days with at least one dictation, counting back from today
// (or yesterday, if today has none yet).
function dayStreak(all) {
  const day = new Date()
  if (!all[todayKey()]) day.setDate(day.getDate() - 1)
  let streak = 0
  for (;;) {
    const key = day.toISOString().slice(0, 10)
    if (!all[key] || all[key].dictations < 1) break
    streak += 1
    day.setDate(day.getDate() - 1)
  }
  return streak
}

export function usageSummary() {
  const all = readAll()
  const days = Object.keys(all).sort()
  const totals = days.reduce(
    (acc, d) => ({
      dictations: acc.dictations + all[d].dictations,
      audioSeconds: acc.audioSeconds + all[d].audioSeconds,
      words: acc.words + (all[d].words ?? 0),
    }),
    { dictations: 0, audioSeconds: 0, words: 0 },
  )
  return {
    today: all[todayKey()] ?? { dictations: 0, audioSeconds: 0, words: 0 },
    // Last 14 days, oldest first — feeds the Insights chart.
    days: Object.keys(all)
      .sort()
      .slice(-14)
      .map((date) => ({ date, ...all[date] })),
    last30Days: {
      ...totals,
      trackedDays: days.length,
      wpm:
        totals.audioSeconds > 0
          ? Math.round(totals.words / (totals.audioSeconds / 60))
          : 0,
      dayStreak: dayStreak(all),
      estimatedCostUsd: (totals.audioSeconds / 3600) * COST_PER_AUDIO_HOUR,
    },
  }
}
