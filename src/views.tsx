// NeuralAir secondary views — Phase 3.
// Each sidebar nav item maps to a real feature. All views save immediately
// through saveSettings (no Save button) or copy through the clipboard bridge.

import { useEffect, useState } from 'react'

/* ---------- Insights: usage over the last 14 days ---------- */

export function InsightsView({ usage }: { usage: UsageSummary | null }) {
  if (!usage) return <main className="content"><p className="empty">Loading…</p></main>
  const days = usage.days ?? []
  const max = Math.max(1, ...days.map((d) => d.words))

  return (
    <main className="content">
      <header className="page-head">
        <h1>Insights</h1>
      </header>

      <section className="card">
        <h2>Last 14 days — words per day</h2>
        {days.length === 0 ? (
          <p className="empty">No usage recorded yet.</p>
        ) : (
          <div className="chart" role="img" aria-label="Words dictated per day, last 14 days">
            {days.map((d) => (
              <div key={d.date} className="chart-col" title={`${d.date}: ${d.words} words, ${d.dictations} dictations`}>
                <span className="chart-num">{d.words || ''}</span>
                <div className="chart-bar" style={{ height: `${Math.round((d.words / max) * 100)}%` }} />
                <span className="chart-day">{d.date.slice(8)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Totals</h2>
        <div className="insight-grid">
          <div><strong>{usage.last30Days.words.toLocaleString()}</strong><span>words</span></div>
          <div><strong>{usage.last30Days.dictations}</strong><span>dictations</span></div>
          <div><strong>{usage.last30Days.wpm}</strong><span>wpm average</span></div>
          <div><strong>{usage.last30Days.dayStreak}</strong><span>day streak</span></div>
          <div><strong>${usage.last30Days.estimatedCostUsd.toFixed(2)}</strong><span>estimated cost</span></div>
        </div>
      </section>
    </main>
  )
}

/* ---------- Dictionary: custom vocabulary ---------- */

export function DictionaryView({ settings, onSaved }: { settings: RendererSettings; onSaved: (s: RendererSettings) => void }) {
  const [draft, setDraft] = useState('')

  const save = async (vocabulary: string[]) => {
    const next = await window.neuralair!.saveSettings({ vocabulary })
    onSaved(next)
  }

  const add = async () => {
    const term = draft.trim()
    if (!term || settings.vocabulary.includes(term)) {
      setDraft('')
      return
    }
    setDraft('')
    await save([...settings.vocabulary, term])
  }

  return (
    <main className="content">
      <header className="page-head">
        <h1>Dictionary</h1>
      </header>
      <section className="card">
        <h2>Custom vocabulary</h2>
        <p className="hint" style={{ marginBottom: 10 }}>
          Names and jargon the AI should spell your way. Injected into every polish prompt.
        </p>
        <div className="vocab">
          {settings.vocabulary.map((term) => (
            <span key={term} className="chip">
              {term}
              <button type="button" onClick={() => save(settings.vocabulary.filter((t) => t !== term))} aria-label={`Remove ${term}`}>
                ×
              </button>
            </span>
          ))}
          <input
            className="input vocab-input"
            value={draft}
            placeholder="Add a name or term…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), add())}
            onBlur={add}
          />
        </div>
      </section>
    </main>
  )
}

/* ---------- Snippets: click-to-copy text blocks ---------- */

export function SnippetsView({ settings, onSaved }: { settings: RendererSettings; onSaved: (s: RendererSettings) => void }) {
  const [name, setName] = useState('')
  const [text, setText] = useState('')

  const save = async (snippets: RendererSettings['snippets']) => {
    const next = await window.neuralair!.saveSettings({ snippets })
    onSaved(next)
  }

  const add = async () => {
    if (!name.trim() || !text.trim()) return
    await save([...settings.snippets, { id: Date.now(), name: name.trim(), text: text.trim() }])
    setName('')
    setText('')
  }

  const copy = (snip: RendererSettings['snippets'][number]) => {
    window.neuralair?.copyText(snip.text)
  }

  return (
    <main className="content">
      <header className="page-head">
        <h1>Snippets</h1>
      </header>

      <section className="card">
        <h2>New snippet</h2>
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} placeholder="Email sign-off" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span>Text</span>
          <textarea className="input" rows={3} value={text} placeholder="Best,\nQazi" onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="save-row" style={{ marginTop: 12 }}>
          <button type="button" className="primary" onClick={add} disabled={!name.trim() || !text.trim()}>
            Add snippet
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Your snippets</h2>
        {settings.snippets.length === 0 ? (
          <p className="empty">No snippets yet. Click one to copy it to your clipboard.</p>
        ) : (
          <ul className="snippet-list">
            {settings.snippets.map((snip) => (
              <li key={snip.id}>
                <button type="button" className="snippet" onClick={() => copy(snip)} title={snip.text}>
                  <strong>{snip.name}</strong>
                  <span>{snip.text}</span>
                </button>
                <button type="button" className="icon-btn" onClick={() => save(settings.snippets.filter((s) => s.id !== snip.id))} title="Delete">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

/* ---------- Style: how aggressively output is formatted ---------- */

export function StyleView({ settings, onSaved }: { settings: RendererSettings; onSaved: (s: RendererSettings) => void }) {
  const pick = async (polishMode: 'polished' | 'exact') => {
    const next = await window.neuralair!.saveSettings({ polishMode })
    onSaved(next)
  }

  return (
    <main className="content">
      <header className="page-head">
        <h1>Style</h1>
      </header>
      <section className="card">
        <h2>Text output</h2>
        <div className="style-options">
          <button type="button" className={`style-option ${settings.polishMode === 'polished' ? 'active' : ''}`} onClick={() => pick('polished')}>
            <strong>AI polished</strong>
            <span>Punctuation fixed, filler words removed, formatted for the app you're typing in.</span>
          </button>
          <button type="button" className={`style-option ${settings.polishMode === 'exact' ? 'active' : ''}`} onClick={() => pick('exact')}>
            <strong>Exact transcription</strong>
            <span>Raw transcript, no LLM pass. Fastest, cheapest, nothing sent anywhere except audio.</span>
          </button>
        </div>
      </section>
    </main>
  )
}

/* ---------- Transforms: output casing applied after polish ---------- */

const TRANSFORMS: { key: RendererSettings['transform']; label: string; hint: string }[] = [
  { key: 'none', label: 'No transform', hint: 'Leave the polished text as is.' },
  { key: 'upper', label: 'UPPERCASE', hint: 'Everything capitalized.' },
  { key: 'lower', label: 'lowercase', hint: 'Everything lowercased.' },
  { key: 'title', label: 'Title Case', hint: 'Sentence-style capitalization of each word.' },
]

export function TransformsView({ settings, onSaved }: { settings: RendererSettings; onSaved: (s: RendererSettings) => void }) {
  const pick = async (transform: RendererSettings['transform']) => {
    const next = await window.neuralair!.saveSettings({ transform })
    onSaved(next)
  }

  return (
    <main className="content">
      <header className="page-head">
        <h1>Transforms</h1>
      </header>
      <section className="card">
        <h2>Output casing</h2>
        <p className="hint" style={{ marginBottom: 10 }}>Applied to every dictation after the polish pass.</p>
        <div className="style-options">
          {TRANSFORMS.map((t) => (
            <button key={t.key} type="button" className={`style-option ${settings.transform === t.key ? 'active' : ''}`} onClick={() => pick(t.key)}>
              <strong>{t.label}</strong>
              <span>{t.hint}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

/* ---------- Scratchpad: free text, autosaved, copy button ---------- */

export function ScratchpadView({ settings, onSaved }: { settings: RendererSettings; onSaved: (s: RendererSettings) => void }) {
  const [text, setText] = useState(settings.scratchpad)

  // Autosave debounced — typing shouldn't write on every keystroke.
  useEffect(() => {
    if (text === settings.scratchpad) return
    const timer = setTimeout(() => {
      window.neuralair!.saveSettings({ scratchpad: text }).then(onSaved).catch(() => {})
    }, 600)
    return () => clearTimeout(timer)
  }, [text])

  return (
    <main className="content">
      <header className="page-head">
        <h1>Scratchpad</h1>
      </header>
      <section className="card">
        <h2>Draft anything</h2>
        <p className="hint" style={{ marginBottom: 10 }}>Autosaved as you type. Nothing here is ever dictated or sent anywhere.</p>
        <textarea
          className="input scratchpad"
          rows={14}
          value={text}
          placeholder="Type or paste anything…"
          onChange={(e) => setText(e.target.value)}
        />
        <div className="save-row" style={{ marginTop: 12 }}>
          <button type="button" className="primary" onClick={() => window.neuralair?.copyText(text)}>
            Copy all
          </button>
        </div>
      </section>
    </main>
  )
}
