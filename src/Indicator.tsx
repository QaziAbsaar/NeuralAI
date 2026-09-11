// NeuralAir recording indicator — Phase 4 polish.
// Lives in its own tiny transparent always-on-top window
// (`?window=indicator`, see electron/indicator.js). Pure CSS animation: a
// sage dot that breathes in and out while an expanding ring confirms the
// mic is live. No logic — the window only exists while recording is active,
// so its presence IS the status.

export default function Indicator() {
  return (
    <div className="indicator" role="status" aria-label="Dictation active">
      <span className="indicator-ring" />
      <span className="indicator-ring indicator-ring-late" />
      <span className="indicator-dot" />
    </div>
  )
}
