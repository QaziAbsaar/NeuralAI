// NeuralAir recorder — Phase 1, step 4; VAD auto-stop added in Phase 2.
// Lives in the hidden renderer. Captures mic audio via MediaRecorder into an
// in-memory chunk array (never touches disk, per Architectural Learning 2 in
// CLAUDE.md). On stop, assembles a Blob and ships the bytes to the main process.
//
// VAD (voice-activity detection): an AnalyserNode taps the same mic stream
// and measures RMS loudness. In toggle mode, sustained silence ends the
// recording automatically — no second keypress needed. Hold mode keeps
// recording until the key is released, so the main process disables VAD there.

const VAD_POLL_MS = 100

let mediaRecorder: MediaRecorder | null = null
let chunks: Blob[] = []
let stream: MediaStream | null = null

// VAD state
let audioCtx: AudioContext | null = null
let analyser: AnalyserNode | null = null
let vadTimer: ReturnType<typeof setInterval> | null = null
let vadConfig: VadConfig | null = null
let startedAt = 0
let silentMs = 0

function stopVad(): void {
  if (vadTimer !== null) {
    clearInterval(vadTimer)
    vadTimer = null
  }
  analyser = null
  audioCtx?.close().catch(() => {})
  audioCtx = null
  vadConfig = null
}

function startVad(micStream: MediaStream): void {
  audioCtx = new AudioContext()
  const source = audioCtx.createMediaStreamSource(micStream)
  analyser = audioCtx.createAnalyser()
  analyser.fftSize = 512
  source.connect(analyser)

  const samples = new Float32Array(analyser.fftSize)
  startedAt = performance.now()
  silentMs = 0

  vadTimer = setInterval(() => {
    if (!analyser || !vadConfig) return
    analyser.getFloatTimeDomainData(samples)

    // RMS loudness of the current window.
    let sum = 0
    for (const v of samples) sum += v * v
    const rms = Math.sqrt(sum / samples.length)

    if (rms < vadConfig.threshold) {
      silentMs += VAD_POLL_MS
    } else {
      silentMs = 0
    }

    const elapsed = performance.now() - startedAt
    if (elapsed >= vadConfig.minMs && silentMs >= vadConfig.silenceMs) {
      console.log('[recorder] VAD: silence detected, auto-stopping')
      stopVad()
      stopRecording()
      window.neuralair!.sendAutoStopped()
    }
  }, VAD_POLL_MS)
}

async function startRecording(config: RecorderConfig): Promise<void> {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  } catch (err) {
    console.error('[recorder] mic access denied:', err)
    return
  }

  // webm/opus is what Chromium records natively; Groq's Whisper API accepts it.
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : 'audio/webm'

  chunks = []
  mediaRecorder = new MediaRecorder(stream, { mimeType })

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  mediaRecorder.onstop = () => {
    const blob = new Blob(chunks, { type: mimeType })
    blob.arrayBuffer().then((buffer) => {
      window.neuralair!.sendAudio(new Uint8Array(buffer), mimeType)
    })
    // Release the mic immediately — never hold it open between dictations.
    stopVad()
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    mediaRecorder = null
  }

  // 250ms timeslice keeps the in-memory buffer fresh and bounded.
  mediaRecorder.start(250)
  console.log('[recorder] recording started', mimeType)

  vadConfig = config?.vad ?? null
  if (vadConfig?.enabled) startVad(stream)
}

function stopRecording(): void {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
}

export function initRecorder(): void {
  window.neuralair!.onRecorderStart((config) => void startRecording(config))
  window.neuralair!.onRecorderStop(() => stopRecording())
}
