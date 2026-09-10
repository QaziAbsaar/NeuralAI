// NeuralAir preload — Phase 1, step 4; VAD + scratch additions in Phase 2.
// Bridges IPC between the main process and the hidden renderer's recorder.
// Sandboxed preload: CommonJS, limited require.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('neuralair', {
  // Main tells the renderer to start recording (hotkey-driven). The payload
  // carries the recording source ('toggle' | 'hold') and VAD settings.
  onRecorderStart: (callback) =>
    ipcRenderer.on('recorder:start', (_event, config) => callback(config)),
  onRecorderStop: (callback) => ipcRenderer.on('recorder:stop', () => callback()),
  // Renderer reports it stopped itself (VAD silence) so main can sync state.
  sendAutoStopped: () => ipcRenderer.send('recorder:auto-stopped'),
  // Renderer returns the finished audio buffer (in-memory, never on disk).
  sendAudio: (bytes, mimeType) => ipcRenderer.send('recorder:audio', bytes, mimeType),
})
