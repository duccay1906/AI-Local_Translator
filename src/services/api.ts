import { AppSettings, TranslationHistoryItem, SnipCapturePayload, SnipSelectionResult, OcrStatePayload, VisualTranslationPayload } from '../types';

declare global {
  interface Window {
    electronAPI?: any;
  }
}

export const api = {
  isElectron: () => typeof window !== 'undefined' && !!window.electronAPI,

  getSettings: async (): Promise<AppSettings> => {
    if (window.electronAPI) {
      return await window.electronAPI.getSettings();
    }
    return {
      lmStudioUrl: 'http://192.168.1.130:1234',
      modelName: 'local-model',
      targetLanguage: 'Vietnamese',
      systemPrompt: 'You are a professional translator. Translate the given text into {targetLanguage}.',
      triggerMode: 'hotkey',
      hotkey: 'F8',
      ocrHotkey: 'F9',
      ocrLanguage: 'eng+jpn+kor+chi_sim',
      autoCopySelection: true,
      theme: 'dark',
    };
  },

  saveSettings: async (settings: AppSettings): Promise<AppSettings> => {
    if (window.electronAPI) {
      return await window.electronAPI.saveSettings(settings);
    }
    return settings;
  },

  fetchModels: async (baseUrl: string): Promise<string[]> => {
    if (window.electronAPI) {
      return await window.electronAPI.fetchModels(baseUrl);
    }
    return ['local-model', 'mistral-7b-instruct', 'llama-3-8b-instruct'];
  },

  translateText: (text: string, targetLang?: string) => {
    if (window.electronAPI) {
      window.electronAPI.translateText(text, targetLang);
    }
  },

  cancelTranslation: () => {
    if (window.electronAPI) {
      window.electronAPI.cancelTranslation();
    }
  },

  onTranslateChunk: (callback: (chunk: string) => void) => {
    if (window.electronAPI) {
      return window.electronAPI.onTranslateChunk(callback);
    }
    return () => {};
  },

  onTranslateComplete: (callback: (fullText: string) => void) => {
    if (window.electronAPI) {
      return window.electronAPI.onTranslateComplete(callback);
    }
    return () => {};
  },

  onTranslateError: (callback: (error: string) => void) => {
    if (window.electronAPI) {
      return window.electronAPI.onTranslateError(callback);
    }
    return () => {};
  },

  onTriggerTranslate: (callback: (data: { text: string; x: number; y: number; imagePreview?: string }) => void) => {
    if (window.electronAPI) {
      return window.electronAPI.onTriggerTranslate(callback);
    }
    return () => {};
  },

  onTriggerVisualTranslate: (callback: (data: VisualTranslationPayload & { x?: number; y?: number }) => void) => {
    if (window.electronAPI) {
      return window.electronAPI.onTriggerVisualTranslate(callback);
    }
    return () => {};
  },

  onOcrStateChange: (callback: (data: OcrStatePayload) => void) => {
    if (window.electronAPI) {
      return window.electronAPI.onOcrStateChange(callback);
    }
    return () => {};
  },

  onSnipScreenCapture: (callback: (data: SnipCapturePayload) => void) => {
    if (window.electronAPI) {
      return window.electronAPI.onSnipScreenCapture(callback);
    }
    return () => {};
  },

  onSnipReset: (callback: () => void) => {
    if (window.electronAPI) {
      return window.electronAPI.onSnipReset(callback);
    }
    return () => {};
  },

  notifySnipReady: () => {
    if (window.electronAPI) {
      window.electronAPI.notifySnipReady();
    }
  },

  completeSnipSelection: (payload: SnipSelectionResult) => {
    if (window.electronAPI) {
      window.electronAPI.completeSnipSelection(payload);
    }
  },

  cancelSnipSelection: () => {
    if (window.electronAPI) {
      window.electronAPI.cancelSnipSelection();
    }
  },

  startOcrCapture: () => {
    if (window.electronAPI) {
      window.electronAPI.startOcrCapture();
    }
  },

  closePopup: () => {
    if (window.electronAPI) {
      window.electronAPI.closePopup();
    }
  },

  setPinned: (pinned: boolean) => {
    if (window.electronAPI) {
      window.electronAPI.setPinned(pinned);
    }
  },

  resizePopup: (width: number, height: number) => {
    if (window.electronAPI) {
      window.electronAPI.resizePopup(width, height);
    }
  },

  // Dedicated OCR Dialog Controls
  closeOcrDialog: () => {
    if (window.electronAPI) {
      window.electronAPI.closeOcrDialog();
    }
  },

  setOcrPinned: (pinned: boolean) => {
    if (window.electronAPI) {
      window.electronAPI.setOcrPinned(pinned);
    }
  },

  resizeOcrDialog: (width: number, height: number) => {
    if (window.electronAPI) {
      window.electronAPI.resizeOcrDialog(width, height);
    }
  },

  copyToClipboard: (text: string) => {
    if (window.electronAPI) {
      window.electronAPI.copyToClipboard(text);
    } else {
      navigator.clipboard.writeText(text);
    }
  },

  getHistory: async (): Promise<TranslationHistoryItem[]> => {
    if (window.electronAPI) {
      return await window.electronAPI.getHistory();
    }
    return [];
  },

  clearHistory: async () => {
    if (window.electronAPI) {
      return await window.electronAPI.clearHistory();
    }
  },

  openSettingsWindow: () => {
    if (window.electronAPI) {
      window.electronAPI.openSettingsWindow();
    }
  },
};
