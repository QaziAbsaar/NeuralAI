// NeuralAir preload — Phase 1, step 4; VAD, scratch, and settings in Phase 2-3.
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
  // Live mic level (RMS) for the HUD pill, ~10x/second while recording.
  sendLevel: (level) => ipcRenderer.send('recorder:level', level),
  // Renderer returns the finished audio buffer (in-memory, never on disk).
  sendAudio: (bytes, mimeType) => ipcRenderer.send('recorder:audio', bytes, mimeType),

  // Settings window (Phase 3) — invoke-style request/response.
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  getUsage: () => ipcRenderer.invoke('usage:get'),
  listModels: () => ipcRenderer.invoke('models:list'),
  // Live recording status for the settings window header.
  onStatusChanged: (callback) =>
    ipcRenderer.on('status:changed', (_event, status) => callback(status)),
  // History feed.
  getHistory: () => ipcRenderer.invoke('history:list'),
  copyText: (text) => ipcRenderer.invoke('history:copy', text),
  onHistoryChanged: (callback) => ipcRenderer.on('history:changed', () => callback()),
  // Dashboard actions.
  toggleRecording: () => ipcRenderer.send('ui:toggle'),
  quitApp: () => ipcRenderer.send('app:quit'),
  openExternal: (url) => ipcRenderer.send('open:external', url),
  // HUD pill (indicator window): live level + pipeline stage.
  onIndicatorLevel: (callback) => {
    const listener = (_event, level) => callback(level)
    ipcRenderer.on('indicator:level', listener)
    return () => ipcRenderer.removeListener('indicator:level', listener)
  },
  onIndicatorStage: (callback) => {
    const listener = (_event, stage) => callback(stage)
    ipcRenderer.on('indicator:stage', listener)
    return () => ipcRenderer.removeListener('indicator:stage', listener)
  },
})
