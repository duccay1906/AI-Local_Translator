import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  // Translation stream listeners
  translateText: (text: string, targetLang?: string) => ipcRenderer.send('start-translation', { text, targetLang }),
  cancelTranslation: () => ipcRenderer.send('cancel-translation'),
  onTranslateChunk: (callback: (chunk: string) => void) => {
    const listener = (_: any, chunk: string) => callback(chunk);
    ipcRenderer.on('translate-chunk', listener);
    return () => ipcRenderer.removeListener('translate-chunk', listener);
  },
  onTranslateComplete: (callback: (fullText: string) => void) => {
    const listener = (_: any, fullText: string) => callback(fullText);
    ipcRenderer.on('translate-complete', listener);
    return () => ipcRenderer.removeListener('translate-complete', listener);
  },
  onTranslateError: (callback: (error: string) => void) => {
    const listener = (_: any, error: string) => callback(error);
    ipcRenderer.on('translate-error', listener);
    return () => ipcRenderer.removeListener('translate-error', listener);
  },

  // Event triggered by Global Hotkey or Mouse selection
  onTriggerTranslate: (callback: (data: { text: string; x: number; y: number; imagePreview?: string }) => void) => {
    const listener = (_: any, data: { text: string; x: number; y: number; imagePreview?: string }) => callback(data);
    ipcRenderer.on('trigger-translate', listener);
    return () => ipcRenderer.removeListener('trigger-translate', listener);
  },

  // Visual in-place translation event with bounding boxes
  onTriggerVisualTranslate: (callback: (data: any) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('trigger-visual-translate', listener);
    return () => ipcRenderer.removeListener('trigger-visual-translate', listener);
  },

  // OCR Status & Snipping Overlay IPC
  onOcrStateChange: (callback: (data: { status: 'processing' | 'done' | 'error'; message?: string; imagePreview?: string }) => void) => {
    const listener = (_: any, data: { status: 'processing' | 'done' | 'error'; message?: string; imagePreview?: string }) => callback(data);
    ipcRenderer.on('ocr-state-change', listener);
    return () => ipcRenderer.removeListener('ocr-state-change', listener);
  },
  onSnipScreenCapture: (callback: (data: { scaleFactor: number; ocrLanguage: string; displayBounds: { x: number; y: number; width: number; height: number } }) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('snip-screen-capture', listener);
    return () => ipcRenderer.removeListener('snip-screen-capture', listener);
  },
  onSnipReset: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('snip-reset', listener);
    return () => ipcRenderer.removeListener('snip-reset', listener);
  },
  notifySnipReady: () => {
    ipcRenderer.send('snip-ready-to-show');
  },
  completeSnipSelection: (payload: { rect: { x: number; y: number; width: number; height: number }; viewportWidth: number; viewportHeight: number; ocrLanguage: string; screenX: number; screenY: number }) => {
    ipcRenderer.send('complete-snip-selection', payload);
  },
  cancelSnipSelection: () => {
    ipcRenderer.send('cancel-snip-selection');
  },
  startOcrCapture: () => {
    ipcRenderer.send('start-ocr-capture');
  },

  // Settings management
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  fetchModels: (baseUrl: string) => ipcRenderer.invoke('fetch-models', baseUrl),

  // Floating Window Controls
  closePopup: () => ipcRenderer.send('close-popup'),
  setPinned: (pinned: boolean) => ipcRenderer.send('set-pinned', pinned),
  resizePopup: (width: number, height: number) => ipcRenderer.send('resize-popup', { width, height }),

  // Clipboard & Helpers
  copyToClipboard: (text: string) => ipcRenderer.send('copy-to-clipboard', text),
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),

  // History Management
  getHistory: () => ipcRenderer.invoke('get-history'),
  saveHistory: (history: any[]) => ipcRenderer.invoke('save-history', history),
  clearHistory: () => ipcRenderer.invoke('clear-history'),

  // Open Settings Window
  openSettingsWindow: () => ipcRenderer.send('open-settings-window'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
