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

  // Vision AI Translation Events
  onInitVisionTranslate: (callback: (data: { imagePreview: string; targetLanguage: string }) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('init-vision-translate', listener);
    return () => ipcRenderer.removeListener('init-vision-translate', listener);
  },
  onVisionTranslateChunk: (callback: (chunk: string) => void) => {
    const listener = (_: any, chunk: string) => callback(chunk);
    ipcRenderer.on('vision-translate-chunk', listener);
    return () => ipcRenderer.removeListener('vision-translate-chunk', listener);
  },
  onVisionTranslateComplete: (callback: (fullText: string) => void) => {
    const listener = (_: any, fullText: string) => callback(fullText);
    ipcRenderer.on('vision-translate-complete', listener);
    return () => ipcRenderer.removeListener('vision-translate-complete', listener);
  },
  onVisionTranslateError: (callback: (error: string) => void) => {
    const listener = (_: any, error: string) => callback(error);
    ipcRenderer.on('vision-translate-error', listener);
    return () => ipcRenderer.removeListener('vision-translate-error', listener);
  },
  startVisionTranslation: (data: { imageBase64: string; targetLang?: string }) => {
    ipcRenderer.send('start-vision-translation', data);
  },
  cancelVisionTranslation: () => {
    ipcRenderer.send('cancel-vision-translation');
  },
  getLatestVisionSnippet: () => {
    return ipcRenderer.invoke('get-latest-vision-snippet');
  },

  // Quick Chat Reply & Replace (Outgoing Translation)
  onInitQuickReply: (callback: (data: { sourceText: string; targetLanguage: string; tone: 'polite' | 'standard' | 'casual' }) => void) => {
    const listener = (_: any, data: any) => callback(data);
    ipcRenderer.on('init-quick-reply', listener);
    return () => ipcRenderer.removeListener('init-quick-reply', listener);
  },
  onReplyTranslateChunk: (callback: (chunk: string) => void) => {
    const listener = (_: any, chunk: string) => callback(chunk);
    ipcRenderer.on('reply-translate-chunk', listener);
    return () => ipcRenderer.removeListener('reply-translate-chunk', listener);
  },
  onReplyTranslateComplete: (callback: (fullText: string) => void) => {
    const listener = (_: any, fullText: string) => callback(fullText);
    ipcRenderer.on('reply-translate-complete', listener);
    return () => ipcRenderer.removeListener('reply-translate-complete', listener);
  },
  onReplyTranslateError: (callback: (error: string) => void) => {
    const listener = (_: any, error: string) => callback(error);
    ipcRenderer.on('reply-translate-error', listener);
    return () => ipcRenderer.removeListener('reply-translate-error', listener);
  },
  startReplyTranslation: (data: { text: string; targetLang: string; tone: 'polite' | 'standard' | 'casual' }) => {
    ipcRenderer.send('start-reply-translation', data);
  },
  cancelReplyTranslation: () => {
    ipcRenderer.send('cancel-reply-translation');
  },
  confirmReplyReplace: (translatedText: string) => {
    ipcRenderer.send('confirm-reply-replace', translatedText);
  },
  closeReplyDialog: () => {
    ipcRenderer.send('close-reply-dialog');
  },
  setReplyPinned: (pinned: boolean) => {
    ipcRenderer.send('set-reply-pinned', pinned);
  },
  setReplyPreference: (prefs: { targetLang: string; tone: 'polite' | 'standard' | 'casual' }) => {
    ipcRenderer.send('set-reply-preference', prefs);
  },
  getLatestReplySnippet: () => {
    return ipcRenderer.invoke('get-latest-reply-snippet');
  },
  onReplyConfirmHotkey: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('reply-confirm-hotkey', listener);
    return () => ipcRenderer.removeListener('reply-confirm-hotkey', listener);
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

  // OCR Dialog Controls
  closeOcrDialog: () => ipcRenderer.send('close-ocr-dialog'),
  setOcrPinned: (pinned: boolean) => ipcRenderer.send('set-ocr-pinned', pinned),
  resizeOcrDialog: (width: number, height: number) => ipcRenderer.send('resize-ocr-dialog', { width, height }),

  // LAN Auto-Updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadAndApplyUpdate: (downloadUrl: string) => ipcRenderer.invoke('download-and-apply-update', downloadUrl),
  applyDownloadedUpdate: () => ipcRenderer.invoke('apply-downloaded-update'),
  openUpdateFolder: () => ipcRenderer.invoke('open-update-folder'),
  onUpdateDownloadProgress: (callback: (pct: number) => void) => {
    const listener = (_: any, pct: number) => callback(pct);
    ipcRenderer.on('update-download-progress', listener);
    return () => ipcRenderer.removeListener('update-download-progress', listener);
  },
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Clipboard & Helpers
  copyToClipboard: (text: string) => ipcRenderer.send('copy-to-clipboard', text),
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),

  // History Management
  getHistory: () => ipcRenderer.invoke('get-history'),
  saveHistory: (history: any[]) => ipcRenderer.invoke('save-history', history),
  clearHistory: () => ipcRenderer.invoke('clear-history'),

  // Open Settings Window
  openSettingsWindow: (tab?: string) => ipcRenderer.send('open-settings-window', tab),
  onSwitchSettingsTab: (callback: (tab: string) => void) => {
    const listener = (_: any, tab: string) => callback(tab);
    ipcRenderer.on('switch-settings-tab', listener);
    return () => ipcRenderer.removeListener('switch-settings-tab', listener);
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
