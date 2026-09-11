// Shared type declarations for the preload bridge (window.neuralair), used
// by both the hidden recorder window and the dashboard window. Ambient global
// script — no imports/exports, so these types apply everywhere in src/.

interface VadConfig {
  enabled: boolean
  threshold: number
  silenceMs: number
  minMs: number
}

interface RecorderConfig {
  source: 'toggle' | 'hold'
  vad: VadConfig
}

interface RendererSettings {
  userName: string
  language: string
  polishModel: string
  polishMode: 'polished' | 'exact'
  transform: 'none' | 'upper' | 'lower' | 'title'
  snippets: { id: number; name: string; text: string }[]
  scratchpad: string
  vocabulary: string[]
  holdKeycode: number
  vad: VadConfig
  hasApiKey: boolean
  apiKeySource: 'settings' | 'env' | 'none'
}

interface UsageDay {
  date: string
  dictations: number
  audioSeconds: number
  words: number
}

interface UsageSummary {
  today: { dictations: number; audioSeconds: number; words: number }
  days: UsageDay[]
  last30Days: {
    dictations: number
    audioSeconds: number
    words: number
    trackedDays: number
    wpm: number
    dayStreak: number
    estimatedCostUsd: number
  }
}

interface HistoryEntry {
  id: number
  ts: number
  transcript: string
  polished: string
  wordCount: number
  audioSeconds: number
}

interface Window {
  neuralair?: {
    // Recorder window
    onRecorderStart: (callback: (config: RecorderConfig) => void) => void
    onRecorderStop: (callback: () => void) => void
    sendAutoStopped: () => void
    sendAudio: (bytes: Uint8Array, mimeType: string) => void
    // Settings window
    getSettings: () => Promise<RendererSettings>
    saveSettings: (patch: Partial<RendererSettings & { groqApiKey: string }>) => Promise<RendererSettings>
    getUsage: () => Promise<UsageSummary>
    listModels: () => Promise<string[]>
    onStatusChanged: (callback: (status: string) => void) => void
    getHistory: () => Promise<HistoryEntry[]>
    copyText: (text: string) => Promise<void>
    onHistoryChanged: (callback: () => void) => void
    toggleRecording: () => void
    quitApp: () => void
    openExternal: (url: string) => void
  }
}
