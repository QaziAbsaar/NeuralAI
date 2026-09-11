// NeuralAir main window — Phase 3.
// The app's only visible UI (?window=settings). Three-column quiet-forest
// layout: dark-green sidebar (nav + word quota), sage main feed (greeting,
// feature banner, transcription history), sage status card (agent status,
// stats, voice profile) and a mic FAB. All data flows over the preload bridge.

import { useEffect, useState } from 'react'
import './dashboard.css'
import SettingsView from './SettingsView.tsx'
import { InsightsView, DictionaryView, SnippetsView, StyleView, TransformsView, ScratchpadView } from './views.tsx'

const DAILY_WORD_GOAL = 500

/* Minimal inline icons — stroke/fill inherits currentColor. */
const I = {
  home: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 7L8 2.5 13.5 7v6a.5.5 0 0 1-.5.5h-3v-4h-4v4H3a.5.5 0 0 1-.5-.5V7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
  ),
  insights: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 13V8M6.5 13V3.5M10 13V6M13 13v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
  ),
  dictionary: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 3.2A1.2 1.2 0 0 1 3.7 2h8.8v11.5H3.7a1.2 1.2 0 0 0-1.2 1.2V3.2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /><path d="M2.5 13.5a1.2 1.2 0 0 1 1.2-1.2h8.8" stroke="currentColor" strokeWidth="1.3" /></svg>
  ),
  snippets: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5.5 3.5h-2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2M10.5 3.5h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-2M8 2.5v11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
  ),
  style: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 13.5l1-3.2 6.2-6.2a1.3 1.3 0 0 1 1.8 0l.4.4a1.3 1.3 0 0 1 0 1.8L6.2 12.5 3 13.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
  ),
  transforms: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2.5 4.5h7.2M7 2l2.7 2.5L7 7M13.5 11.5H6.3M9 9l-2.7 2.5L9 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ),
  scratchpad: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><path d="M5 6h6M5 8.5h6M5 11h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
  ),
  gear: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" /><path d="M8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M12.4 3.6l-1.1 1.1M4.7 11.3l-1.1 1.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
  ),
  help: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.3" /><path d="M6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.5.2-.8.6-.8 1.1v.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><circle cx="8" cy="11.6" r="0.8" fill="currentColor" /></svg>
  ),
  copy: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><path d="M10.5 3.5v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1" stroke="currentColor" strokeWidth="1.3" /></svg>
  ),
  flag: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 14.5V2M3.5 2.5h8l-1.8 3 1.8 3h-8" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
  ),
  dots: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><circle cx="8" cy="3.5" r="1.2" /><circle cx="8" cy="8" r="1.2" /><circle cx="8" cy="12.5" r="1.2" /></svg>
  ),
  mic: (
    <svg width="20" height="20" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="6" y="1.8" width="4" height="7.4" rx="2" stroke="currentColor" strokeWidth="1.4" /><path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
  ),
  waveform: (
    <svg width="18" height="12" viewBox="0 0 18 12" fill="none" aria-hidden="true"><path d="M2 5.5v1M4.5 3.5v5M7 1.5v9M9.5 4v4M12 2.5v7M14.5 5v2M17 5.5v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
  ),
  user: (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="5.5" r="2.7" stroke="currentColor" strokeWidth="1.3" /><path d="M2.8 13.5a5.2 5.2 0 0 1 10.4 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg>
  ),
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function dayLabel(ts: number): string {
  const date = new Date(ts)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(date, today)) return 'Today'
  if (sameDay(date, yesterday)) return 'Yesterday'
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

const MAIN_NAV = [
  { key: 'home', label: 'Home', icon: I.home },
  { key: 'insights', label: 'Insights', icon: I.insights },
  { key: 'dictionary', label: 'Dictionary', icon: I.dictionary },
  { key: 'snippets', label: 'Snippets', icon: I.snippets },
  { key: 'style', label: 'Style', icon: I.style },
  { key: 'transforms', label: 'Transforms', icon: I.transforms },
  { key: 'scratchpad', label: 'Scratchpad', icon: I.scratchpad },
] as const

export default function Dashboard() {
  const [nav, setNav] = useState<string>('home')
  const [settings, setSettings] = useState<RendererSettings | null>(null)
  const [usage, setUsage] = useState<UsageSummary | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [status, setStatus] = useState('idle')
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [models, setModels] = useState<string[]>([])
  const [modelOpen, setModelOpen] = useState(false)
  const [modelSaving, setModelSaving] = useState(false)

  const loadAll = () => {
    window.neuralair?.getUsage().then(setUsage).catch(() => {})
    window.neuralair?.getHistory().then(setHistory).catch(() => {})
  }

  useEffect(() => {
    window.neuralair?.getSettings().then(setSettings).catch(() => {})
    loadAll()
    window.neuralair?.onStatusChanged(setStatus)
    // A finished dictation refills the feed and the stats together.
    window.neuralair?.onHistoryChanged(loadAll)
  }, [])

  const pickModel = async (model: string) => {
    setModelOpen(false)
    setModelSaving(true)
    try {
      const next = await window.neuralair!.saveSettings({ polishModel: model })
      setSettings(next)
    } finally {
      setModelSaving(false)
    }
  }

  const copyEntry = (entry: HistoryEntry) => {
    window.neuralair?.copyText(entry.polished)
    setCopiedId(entry.id)
    setTimeout(() => setCopiedId((id) => (id === entry.id ? null : id)), 1500)
  }

  // Feed grouped by day, newest group first (history already newest-first).
  const groups: { label: string; items: HistoryEntry[] }[] = []
  for (const entry of history) {
    const label = dayLabel(entry.ts)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(entry)
    else groups.push({ label, items: [entry] })
  }

  const name = settings?.userName ? settings.userName[0].toUpperCase() + settings.userName.slice(1) : 'there'
  const wordsThisMonth = usage?.last30Days.words ?? 0
  const todayWords = usage?.today.words ?? 0
  const quotaPct = Math.min(100, Math.round((todayWords / DAILY_WORD_GOAL) * 100))
  const recording = status === 'recording'

  return (
    <div className="app">
      {/* ---------- Sidebar ---------- */}
      <aside className="sidebar">
        <span className="brand">NeuralAir</span>

        <div className="quota">
          <span className="quota-label">Words dictated</span>
          <strong className="quota-num">{todayWords.toLocaleString()} today</strong>
          <div className="quota-bar" role="progressbar" aria-valuenow={quotaPct} aria-valuemin={0} aria-valuemax={100} aria-label="Words toward today's goal">
            <div className="quota-fill" style={{ width: `${quotaPct}%` }} />
          </div>
          <div className="model-pick">
            <button
              type="button"
              className="model-btn"
              aria-expanded={modelOpen}
              onClick={() => {
                setModelOpen(!modelOpen)
                if (!modelOpen && models.length === 0) {
                  window.neuralair?.listModels().then(setModels).catch(() => {})
                }
              }}
            >
              {modelSaving ? 'Switching…' : settings?.polishModel ?? 'Select model'}
            </button>
            {modelOpen && (
              <ul className="model-list">
                {models.length === 0 && <li className="model-empty">No models — check your API key.</li>}
                {models.map((m) => (
                  <li key={m}>
                    <button
                      type="button"
                      className={m === settings?.polishModel ? 'current' : ''}
                      onClick={() => pickModel(m)}
                    >
                      {m}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <nav className="main-nav" aria-label="Main">
          {MAIN_NAV.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              className={`nav-item ${nav === key ? 'active' : ''}`}
              onClick={() => setNav(key)}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>

        <nav className="bottom-nav" aria-label="Secondary">
          <button type="button" className={`nav-item ${nav === 'settings' ? 'active' : ''}`} onClick={() => setNav('settings')}>
            {I.gear}
            Settings
          </button>
          <button type="button" className="nav-item" onClick={() => window.neuralair?.openExternal('https://github.com/QaziAbsaar/NeuralAI')}>
            {I.help}
            Help
          </button>
          <button type="button" className="nav-item" onClick={() => window.neuralair?.quitApp()}>
            Quit NeuralAir
          </button>
        </nav>
      </aside>

      {/* ---------- Views ---------- */}
      {nav === 'settings' && settings ? (
        <SettingsView settings={settings} onSaved={loadAll} />
      ) : nav === 'insights' ? (
        <InsightsView usage={usage} />
      ) : nav === 'dictionary' && settings ? (
        <DictionaryView settings={settings} onSaved={setSettings} />
      ) : nav === 'snippets' && settings ? (
        <SnippetsView settings={settings} onSaved={setSettings} />
      ) : nav === 'style' && settings ? (
        <StyleView settings={settings} onSaved={setSettings} />
      ) : nav === 'transforms' && settings ? (
        <TransformsView settings={settings} onSaved={setSettings} />
      ) : nav === 'scratchpad' && settings ? (
        <ScratchpadView settings={settings} onSaved={setSettings} />
      ) : (
        <div className="columns">
          <main className="content">
            <header className="page-head">
              <h1>Welcome back, {name}</h1>
              <span className="avatar" aria-label="Account">{I.user}</span>
            </header>

            <section className="banner">
              <h2>Connect with Flow Hub in another app</h2>
              <p>Flow works anywhere you type.</p>
              <button type="button" className="banner-btn">Get started</button>
            </section>

            <section className="feed" aria-label="Transcription history">
              {groups.length === 0 ? (
                <p className="empty">No dictations yet. Hold your talk key and speak.</p>
              ) : (
                groups.map((group) => (
                  <div key={group.label} className="feed-group">
                    <span className="feed-date">{group.label}</span>
                    <ul>
                      {group.items.map((entry, idx) => {
                        // The newest entry of the newest group gets the
                        // active highlight while a dictation is processing.
                        const active = recording && idx === 0 && groups[0].items[0].id === entry.id
                        return (
                          <li key={entry.id} className={active ? 'active' : ''}>
                            <span className="feed-time">
                              {active && <i className="live-dot" aria-hidden="true" />}
                              {formatTime(entry.ts)}
                            </span>
                            <span className="feed-text" title={entry.polished}>{entry.polished}</span>
                            <span className="feed-actions">
                              <button type="button" className="icon-btn" onClick={() => copyEntry(entry)} title="Copy text">
                                {copiedId === entry.id ? 'Copied' : I.copy}
                              </button>
                              <button type="button" className="icon-btn" title="Flag">{I.flag}</button>
                              <button type="button" className="icon-btn" title="More">{I.dots}</button>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))
              )}
            </section>

            <div className="fab-wrap">
              <span className={`fab-dot ${recording ? 'on' : ''}`} aria-hidden="true" />
              <button
                type="button"
                className="fab"
                onClick={() => window.neuralair?.toggleRecording()}
                title={recording ? 'Stop dictation' : 'Start a dictation'}
              >
                {I.mic}
              </button>
            </div>
          </main>

          {/* ---------- Status card ---------- */}
          <aside className="status-card">
            <span className="motif tl" aria-hidden="true" />
            <span className="motif br" aria-hidden="true" />

            <div className="status-head">
              <strong>Agent status</strong>
              <span className={`agent-state ${recording ? 'live' : ''}`}>
                <i className="agent-dot" aria-hidden="true" />
                {recording ? 'Recording' : 'Learning and active'}
              </span>
            </div>

            <div className="stats-grid">
              <div>
                <strong>{wordsThisMonth.toLocaleString()}</strong>
                <span>Words</span>
              </div>
              <div>
                <strong>{usage?.last30Days.wpm ?? 0}</strong>
                <span>wpm</span>
              </div>
              <div>
                <strong>{usage?.last30Days.dayStreak ?? 0}</strong>
                <span>Day</span>
              </div>
            </div>

            <div className="profile">
              <span className="profile-label">{I.waveform} Voice profile</span>
              <div className="profile-row">
                <div className="profile-bar" role="progressbar" aria-valuenow={quotaPct} aria-valuemin={0} aria-valuemax={100} aria-label="Voice profile progress">
                  <div className="profile-fill" style={{ width: `${quotaPct}%` }} />
                </div>
                <span className={`waveform ${recording ? 'live' : ''}`} aria-hidden="true">{I.waveform}</span>
              </div>
              <span className="profile-hint">
                {recording ? 'Listening…' : todayWords >= DAILY_WORD_GOAL ? 'Daily goal reached' : `${todayWords.toLocaleString()} of ${DAILY_WORD_GOAL} words today`}
              </span>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
