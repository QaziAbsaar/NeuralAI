import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Dashboard from './Dashboard.tsx'
import { initRecorder } from './recorder.ts'

// Two windows share this bundle: the hidden recorder window (default) and the
// dashboard window (?window=settings, opened from the tray).
const isSettingsWindow = new URLSearchParams(window.location.search).get('window') === 'settings'

// The hidden recorder window hosts the audio capture. Guard: window.neuralair
// only exists inside Electron (preload). Serving the renderer in a plain
// browser (e.g. opening localhost:5173 directly) is fine — it just shows
// nothing and does nothing.
if (window.neuralair && !isSettingsWindow) initRecorder()

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isSettingsWindow ? <Dashboard /> : <App />}</StrictMode>,
)
