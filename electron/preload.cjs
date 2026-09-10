// NeuralAir preload — Phase 1, step 4.
// Bridges IPC between the main process and the hidden renderer's recorder.
// Sandboxed preload: CommonJS, limited require.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('neuralair', {
  // Main tells the renderer to start/stop recording (hotkey-driven).
  onRecorderStart: (callback) => ipcRenderer.on('recorder:start', () => callback()),
  onRecorderStop: (callback) => ipcRenderer.on('recorder:stop', () => callback()),
  // Renderer returns the finished audio buffer (in-memory, never on disk).
  sendAudio: (bytes, mimeType) => ipcRenderer.send('recorder:audio', bytes, mimeType),
})
