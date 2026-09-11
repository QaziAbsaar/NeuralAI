// NeuralAir settings view — Phase 3.
// Rendered in place of the main feed when Settings is picked in the sidebar.
// Owns the form state; the dashboard passes loaded settings in and reloads
// usage on save.

import { useState } from 'react'

const keyHint = (code: number) =>
  code === 0 ? 'off' : code === 67 ? 'F9' : code === 87 ? 'F11' : code === 88 ? 'F12' : `code ${code}`

export default function SettingsView({
  settings,
  onSaved,
}: {
  settings: RendererSettings
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<RendererSettings>(settings)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [vocabDraft, setVocabDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const patch = (p: Partial<RendererSettings>) => {
    setDraft({ ...draft, ...p })
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const next = await window.neuralair!.saveSettings({
        language: draft.language.trim(),
        polishMode: draft.polishMode,
        vocabulary: draft.vocabulary,
        holdKeycode: draft.holdKeycode,
        vad: draft.vad,
        ...(apiKeyInput.trim() ? { groqApiKey: apiKeyInput.trim() } : {}),
      })
      setDraft(next)
      setApiKeyInput('')
      setSaved(true)
      onSaved()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const addVocabTerm = () => {
    const term = vocabDraft.trim()
    if (term && !draft.vocabulary.includes(term)) {
      patch({ vocabulary: [...draft.vocabulary, term] })
    }
    setVocabDraft('')
  }

  return (
    <main className="content settings-view">
      <header className="page-head">
        <h1>Settings</h1>
      </header>

      <section className="card">
        <h2>Groq API key</h2>
        <input
          type="password"
          className="input"
          value={apiKeyInput}
          placeholder={
            draft.hasApiKey
              ? draft.apiKeySource === 'env'
                ? 'Set in .env — enter a key here to store it securely instead'
                : 'Saved — enter a new key to replace it'
              : 'gsk-…'
          }
          onChange={(e) => setApiKeyInput(e.target.value)}
          autoComplete="off"
        />
        <p className="hint">
          {draft.hasApiKey && draft.apiKeySource === 'settings'
            ? 'Stored encrypted with your system keychain.'
            : 'Stored encrypted with your system keychain, never in plain text.'}
        </p>
      </section>

      <section className="card">
        <h2>Dictation</h2>
        <label className="field">
          <span>Language</span>
          <input
            className="input"
            value={draft.language}
            placeholder="en"
            maxLength={2}
            onChange={(e) => patch({ language: e.target.value.toLowerCase() })}
          />
          <span className="hint">Two-letter code, e.g. en, is, ur. Empty lets Whisper auto-detect.</span>
        </label>

        <div className="field">
          <span>Text output</span>
          <div className="segmented" role="radiogroup">
            <button
              type="button"
              className={draft.polishMode === 'polished' ? 'active' : ''}
              onClick={() => patch({ polishMode: 'polished' })}
            >
              AI polished
            </button>
            <button
              type="button"
              className={draft.polishMode === 'exact' ? 'active' : ''}
              onClick={() => patch({ polishMode: 'exact' })}
            >
              Exact transcription
            </button>
          </div>
        </div>

        <label className="field row">
          <input
            type="checkbox"
            checked={draft.vad.enabled}
            onChange={(e) => patch({ vad: { ...draft.vad, enabled: e.target.checked } })}
          />
          <span className="check-label">Auto-stop on silence in toggle mode</span>
        </label>

        <div className="field">
          <span>Custom vocabulary</span>
          <div className="vocab">
            {draft.vocabulary.map((term) => (
              <span key={term} className="chip">
                {term}
                <button
                  type="button"
                  onClick={() => patch({ vocabulary: draft.vocabulary.filter((t) => t !== term) })}
                  aria-label={`Remove ${term}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              className="input vocab-input"
              value={vocabDraft}
              placeholder="Add a name or term…"
              onChange={(e) => setVocabDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addVocabTerm()
                }
              }}
              onBlur={addVocabTerm}
            />
          </div>
          <span className="hint">Names and jargon the AI should spell your way.</span>
        </div>
      </section>

      <section className="card">
        <h2>Keys</h2>
        <label className="field">
          <span>Hold-to-talk key code ({keyHint(draft.holdKeycode)})</span>
          <input
            className="input"
            type="number"
            min={0}
            value={draft.holdKeycode || ''}
            placeholder="0"
            onChange={(e) => patch({ holdKeycode: Number(e.target.value) || 0 })}
          />
          <span className="hint">
            Linux input code — 67 is F9, 87 is F11. Hold it to record, release to stop. Takes effect after
            restarting NeuralAir.
          </span>
        </label>

        <div className="field">
          <span>Bind these in your desktop's shortcut settings</span>
          <code className="cmd">electron . --toggle</code>
          <code className="cmd">electron . --scratch</code>
          <span className="hint">Toggle starts/stops a dictation; scratch removes the last one.</span>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <div className="save-row">
        <button type="button" className="primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        {saved && !saving && <span className="saved-note">Saved</span>}
      </div>
    </main>
  )
}
