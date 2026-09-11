import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Dashboard from './Dashboard.tsx'
import Indicator from './Indicator.tsx'
import { initRecorder } from './recorder.ts'

// Three windows share this bundle: the hidden recorder window (default), the
// dashboard window (?window=settings, opened from the tray), and the
// recording indicator overlay (?window=indicator — a tiny pulsing dot pinned
// to the screen corner while dictation is active).
const windowKind = new URLSearchParams(window.location.search).get('window')
const isSettingsWindow = windowKind === 'settings'
const isIndicatorWindow = windowKind === 'indicator'

// The hidden recorder window hosts the audio capture. Guard: window.neuralair
// only exists inside Electron (preload). Serving the renderer in a plain
// browser (e.g. opening localhost:5173 directly) is fine — it just shows
// nothing and does nothing.
if (window.neuralair && !isSettingsWindow && !isIndicatorWindow) initRecorder()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSettingsWindow ? <Dashboard /> : isIndicatorWindow ? <Indicator /> : <App />}
  </StrictMode>,
)
