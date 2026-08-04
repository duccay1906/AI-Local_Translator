import { AppSettings, TranslationHistoryItem } from '../types';

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

  onTriggerTranslate: (callback: (data: { text: string; x: number; y: number }) => void) => {
    if (window.electronAPI) {
      return window.electronAPI.onTriggerTranslate(callback);
    }
    return () => {};
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
