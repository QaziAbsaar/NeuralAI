import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initRecorder } from './recorder.ts'

// The hidden renderer's whole job in Phase 1 is hosting the recorder.
// Guard: window.neuralair only exists inside Electron (preload). Serving the
// renderer in a plain browser (e.g. opening localhost:5173 directly) is fine —
// it just shows nothing and does nothing.
if (window.neuralair) initRecorder()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
