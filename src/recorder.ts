// NeuralAir recorder — Phase 1, step 4.
// Lives in the hidden renderer. Captures mic audio via MediaRecorder into an
// in-memory chunk array (never touches disk, per Architectural Learning 2 in
// CLAUDE.md). On stop, assembles a Blob and ships the bytes to the main process.

declare global {
  interface Window {
    neuralair: {
      onRecorderStart: (callback: () => void) => void
      onRecorderStop: (callback: () => void) => void
      sendAudio: (bytes: Uint8Array, mimeType: string) => void
    }
  }
}

let mediaRecorder: MediaRecorder | null = null
let chunks: Blob[] = []
let stream: MediaStream | null = null

async function startRecording(): Promise<void> {
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
      window.neuralair.sendAudio(new Uint8Array(buffer), mimeType)
    })
    // Release the mic immediately — never hold it open between dictations.
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    mediaRecorder = null
  }

  // 250ms timeslice keeps the in-memory buffer fresh and bounded.
  mediaRecorder.start(250)
  console.log('[recorder] recording started', mimeType)
}

function stopRecording(): void {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
}

export function initRecorder(): void {
  window.neuralair.onRecorderStart(() => void startRecording())
  window.neuralair.onRecorderStop(() => stopRecording())
}
