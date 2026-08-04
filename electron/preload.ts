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
  onTriggerTranslate: (callback: (data: { text: string; x: number; y: number }) => void) => {
    const listener = (_: any, data: { text: string; x: number; y: number }) => callback(data);
    ipcRenderer.on('trigger-translate', listener);
    return () => ipcRenderer.removeListener('trigger-translate', listener);
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
