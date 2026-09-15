// NeuralAir recording HUD pill.
// Lives in its own transparent always-on-top window (`?window=indicator`,
// see electron/indicator.js). Shows what the pipeline is doing right now —
// a pulsing dot and a live mic-level bar while listening, then the
// processing stage with elapsed milliseconds (Listening → Transcribing →
// Polishing → Done). The window only exists while a dictation is in flight,
// driven entirely by IPC from main.

import { useEffect, useState } from 'react'

type Stage = 'listening' | 'transcribing' | 'polishing' | 'done'

const STAGE_LABELS: Record<Stage, string> = {
  listening: 'Listening',
  transcribing: 'Transcribing',
  polishing: 'Polishing',
  done: 'Done',
}

export default function Indicator() {
  const [stage, setStage] = useState<Stage>('listening')
  const [stageAt, setStageAt] = useState(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [level, setLevel] = useState(0)

  useEffect(() => {
    const offStage = window.neuralair?.onIndicatorStage(({ stage: s, at }) => {
      setStage(s)
      setStageAt(at)
    })
    const offLevel = window.neuralair?.onIndicatorLevel(setLevel)
    return () => {
      offStage?.()
      offLevel?.()
    }
  }, [])

  // Ticking elapsed counter for the current stage.
  useEffect(() => {
    setElapsed(0)
    const timer = setInterval(() => setElapsed(Date.now() - stageAt), 100)
    return () => clearInterval(timer)
  }, [stageAt])

  return (
    <div className="indicator" role="status" aria-label={`Dictation ${stage}`}>
      <span className={`indicator-dot ${stage === 'listening' ? 'on' : ''}`} />
      {stage === 'listening' ? (
        <span className="indicator-level">
          <span className="indicator-level-fill" style={{ width: `${Math.min(100, level * 800)}%` }} />
        </span>
      ) : (
        <span className="indicator-ring-static" />
      )}
      <span className="indicator-label">
        {STAGE_LABELS[stage]}
        {stage !== 'done' && <span className="indicator-ms">{elapsed}ms</span>}
      </span>
    </div>
  )
}
