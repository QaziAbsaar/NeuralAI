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
  const [llmKeyInput, setLlmKeyInput] = useState('')
  const [sttKeyInput, setSttKeyInput] = useState('')
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
        sttProvider: draft.sttProvider,
        sttModel: draft.sttModel.trim(),
        ...(sttKeyInput.trim() &&
          ['openai', 'deepgram', 'assemblyai', 'elevenlabs'].includes(draft.sttProvider) && {
            [`${draft.sttProvider}SttKey`]: sttKeyInput.trim(),
          }),
        llmProvider: draft.llmProvider,
        llmBaseUrl: draft.llmBaseUrl.trim(),
        llmModel: draft.llmModel.trim(),
        ...(apiKeyInput.trim() ? { groqApiKey: apiKeyInput.trim() } : {}),
        ...(llmKeyInput.trim() ? { llmApiKey: llmKeyInput.trim() } : {}),
      })
      setDraft(next)
      setApiKeyInput('')
      setLlmKeyInput('')
      setSttKeyInput('')
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
        <h2>Providers</h2>

        <div className="field">
          <span>Transcription</span>
          <div className="segmented" role="radiogroup">
            <button
              type="button"
              className={draft.sttProvider === 'auto' ? 'active' : ''}
              onClick={() => patch({ sttProvider: 'auto' })}
            >
              Auto
            </button>
            <button
              type="button"
              className={draft.sttProvider === 'groq' ? 'active' : ''}
              onClick={() => patch({ sttProvider: 'groq' })}
            >
              Groq
            </button>
            <button
              type="button"
              className={draft.sttProvider === 'openai' ? 'active' : ''}
              onClick={() => patch({ sttProvider: 'openai' })}
            >
              OpenAI
            </button>
            <button
              type="button"
              className={draft.sttProvider === 'deepgram' ? 'active' : ''}
              onClick={() => patch({ sttProvider: 'deepgram' })}
            >
              Deepgram
            </button>
            <button
              type="button"
              className={draft.sttProvider === 'assemblyai' ? 'active' : ''}
              onClick={() => patch({ sttProvider: 'assemblyai' })}
            >
              AssemblyAI
            </button>
            <button
              type="button"
              className={draft.sttProvider === 'elevenlabs' ? 'active' : ''}
              onClick={() => patch({ sttProvider: 'elevenlabs' })}
            >
              ElevenLabs
            </button>
            <button
              type="button"
              className={draft.sttProvider === 'local' ? 'active' : ''}
              onClick={() => patch({ sttProvider: 'local' })}
            >
              Local
            </button>
          </div>
          <span className="hint">
            Auto uses Groq and falls back to a local whisper.cpp install when it is down or slow. Every other
            choice pins that provider. Local runs fully offline.
          </span>
        </div>

        {['openai', 'deepgram', 'assemblyai', 'elevenlabs'].includes(draft.sttProvider) && (
          <>
            <label className="field">
              <span>Model (optional)</span>
              <input
                className="input"
                value={draft.sttModel}
                placeholder={
                  draft.sttProvider === 'openai'
                    ? 'gpt-4o-mini-transcribe (default) — or gpt-4o-transcribe'
                    : draft.sttProvider === 'deepgram'
                      ? 'nova-3 (default) — or nova-2'
                      : draft.sttProvider === 'assemblyai'
                        ? 'universal-2 (default) — or universal-3-5-pro'
                        : 'scribe_v1 (default)'
                }
                onChange={(e) => patch({ sttModel: e.target.value })}
              />
            </label>
            <label className="field">
              <span>
                {draft.sttProvider === 'openai'
                  ? 'OpenAI API key'
                  : draft.sttProvider === 'deepgram'
                    ? 'Deepgram API key'
                    : draft.sttProvider === 'assemblyai'
                      ? 'AssemblyAI API key'
                      : 'ElevenLabs API key'}
              </span>
              <input
                type="password"
                className="input"
                value={sttKeyInput}
                placeholder={
                  ({
                    openai: draft.hasOpenaiSttKey,
                    deepgram: draft.hasDeepgramSttKey,
                    assemblyai: draft.hasAssemblyaiSttKey,
                    elevenlabs: draft.hasElevenlabsSttKey,
                  }[draft.sttProvider as 'openai'])
                    ? 'Saved — enter a new key to replace it'
                    : 'sk-… / key from the provider console'
                }
                onChange={(e) => setSttKeyInput(e.target.value)}
                autoComplete="off"
              />
              <span className="hint">Stored encrypted with your system keychain.</span>
            </label>
          </>
        )}

        <div className="field">
          <span>Text formatting</span>
          <div className="segmented" role="radiogroup">
            <button
              type="button"
              className={draft.llmProvider === 'groq' ? 'active' : ''}
              onClick={() => patch({ llmProvider: 'groq' })}
            >
              Groq
            </button>
            <button
              type="button"
              className={draft.llmProvider === 'nvidia' ? 'active' : ''}
              onClick={() => patch({ llmProvider: 'nvidia' })}
            >
              NVIDIA NIM
            </button>
            <button
              type="button"
              className={draft.llmProvider === 'openai-compatible' ? 'active' : ''}
              onClick={() => patch({ llmProvider: 'openai-compatible' })}
            >
              Custom
            </button>
            <button
              type="button"
              className={draft.llmProvider === 'none' ? 'active' : ''}
              onClick={() => patch({ llmProvider: 'none' })}
            >
              None
            </button>
          </div>
          <span className="hint">
            Custom takes any OpenAI-compatible endpoint (OpenAI, OpenRouter, LM Studio, Ollama). None skips
            the polish pass — works with a fully local pipeline.
          </span>
        </div>

        {draft.llmProvider === 'nvidia' && (
          <>
            <label className="field">
              <span>Model</span>
              <input
                className="input"
                value={draft.llmModel}
                placeholder="meta/llama-3.1-70b-instruct"
                onChange={(e) => patch({ llmModel: e.target.value })}
              />
              <span className="hint">Model names from build.nvidia.com, including the owner prefix.</span>
            </label>
            <label className="field">
              <span>NVIDIA API key</span>
              <input
                type="password"
                className="input"
                value={llmKeyInput}
                placeholder={draft.hasLlmKey ? 'Saved — enter a new key to replace it' : 'nvapi-…'}
                onChange={(e) => setLlmKeyInput(e.target.value)}
                autoComplete="off"
              />
              <span className="hint">Create one at build.nvidia.com. Stored encrypted with your system keychain.</span>
            </label>
          </>
        )}

        {draft.llmProvider === 'openai-compatible' && (
          <>
            <label className="field">
              <span>Base URL</span>
              <input
                className="input"
                value={draft.llmBaseUrl}
                placeholder="http://localhost:1234/v1"
                onChange={(e) => patch({ llmBaseUrl: e.target.value })}
              />
              <span className="hint">The API root that serves /chat/completions.</span>
            </label>
            <label className="field">
              <span>Model</span>
              <input
                className="input"
                value={draft.llmModel}
                placeholder="llama3.1"
                onChange={(e) => patch({ llmModel: e.target.value })}
              />
            </label>
            <label className="field">
              <span>API key</span>
              <input
                type="password"
                className="input"
                value={llmKeyInput}
                placeholder={draft.hasLlmKey ? 'Saved — enter a new key to replace it' : 'sk-… (often optional for local servers)'}
                onChange={(e) => setLlmKeyInput(e.target.value)}
                autoComplete="off"
              />
            </label>
          </>
        )}
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
