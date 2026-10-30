import { AppSettings, TranslationHistoryItem, SnipCapturePayload, SnipSelectionResult, OcrStatePayload, VisualTranslationPayload, UpdateCheckResult, QuickReplyPayload, ReplyTone } from '../types';

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

  // Vision AI Translation
  onInitVisionTranslate: (callback: (data: { imagePreview: string; targetLanguage: string }) => void) => {
    if (window.electronAPI && (window.electronAPI as any).onInitVisionTranslate) {
      return (window.electronAPI as any).onInitVisionTranslate(callback);
    }
    return () => {};
  },

  onVisionTranslateChunk: (callback: (chunk: string) => void) => {
    if (window.electronAPI && (window.electronAPI as any).onVisionTranslateChunk) {
      return (window.electronAPI as any).onVisionTranslateChunk(callback);
    }
    return () => {};
  },

  onVisionTranslateComplete: (callback: (fullText: string) => void) => {
    if (window.electronAPI && (window.electronAPI as any).onVisionTranslateComplete) {
      return (window.electronAPI as any).onVisionTranslateComplete(callback);
    }
    return () => {};
  },

  onVisionTranslateError: (callback: (error: string) => void) => {
    if (window.electronAPI && (window.electronAPI as any).onVisionTranslateError) {
      return (window.electronAPI as any).onVisionTranslateError(callback);
    }
    return () => {};
  },

  startVisionTranslation: (data: { imageBase64: string; targetLang?: string }) => {
    if (window.electronAPI && (window.electronAPI as any).startVisionTranslation) {
      (window.electronAPI as any).startVisionTranslation(data);
    }
  },

  cancelVisionTranslation: () => {
    if (window.electronAPI && (window.electronAPI as any).cancelVisionTranslation) {
      (window.electronAPI as any).cancelVisionTranslation();
    }
  },

  getLatestVisionSnippet: async (): Promise<{ imagePreview: string; targetLanguage: string } | null> => {
    if (window.electronAPI && (window.electronAPI as any).getLatestVisionSnippet) {
      return await (window.electronAPI as any).getLatestVisionSnippet();
    }
    return null;
  },

  // Quick Chat Reply & Replace (Outgoing Translation)
  onInitQuickReply: (callback: (data: QuickReplyPayload) => void) => {
    if (window.electronAPI && (window.electronAPI as any).onInitQuickReply) {
      return (window.electronAPI as any).onInitQuickReply(callback);
    }
    return () => {};
  },

  onReplyTranslateChunk: (callback: (chunk: string) => void) => {
    if (window.electronAPI && (window.electronAPI as any).onReplyTranslateChunk) {
      return (window.electronAPI as any).onReplyTranslateChunk(callback);
    }
    return () => {};
  },

  onReplyTranslateComplete: (callback: (fullText: string) => void) => {
    if (window.electronAPI && (window.electronAPI as any).onReplyTranslateComplete) {
      return (window.electronAPI as any).onReplyTranslateComplete(callback);
    }
    return () => {};
  },

  onReplyTranslateError: (callback: (error: string) => void) => {
    if (window.electronAPI && (window.electronAPI as any).onReplyTranslateError) {
      return (window.electronAPI as any).onReplyTranslateError(callback);
    }
    return () => {};
  },

  startReplyTranslation: (data: { text: string; targetLang: string; tone: ReplyTone }) => {
    if (window.electronAPI && (window.electronAPI as any).startReplyTranslation) {
      (window.electronAPI as any).startReplyTranslation(data);
    }
  },

  cancelReplyTranslation: () => {
    if (window.electronAPI && (window.electronAPI as any).cancelReplyTranslation) {
      (window.electronAPI as any).cancelReplyTranslation();
    }
  },

  confirmReplyReplace: (translatedText: string) => {
    if (window.electronAPI && (window.electronAPI as any).confirmReplyReplace) {
      (window.electronAPI as any).confirmReplyReplace(translatedText);
    }
  },

  closeReplyDialog: () => {
    if (window.electronAPI && (window.electronAPI as any).closeReplyDialog) {
      (window.electronAPI as any).closeReplyDialog();
    }
  },

  setReplyPinned: (pinned: boolean) => {
    if (window.electronAPI && (window.electronAPI as any).setReplyPinned) {
      (window.electronAPI as any).setReplyPinned(pinned);
    }
  },

  setReplyPreference: (prefs: { targetLang: string; tone: ReplyTone }) => {
    if (window.electronAPI && (window.electronAPI as any).setReplyPreference) {
      (window.electronAPI as any).setReplyPreference(prefs);
    }
  },

  getLatestReplySnippet: async (): Promise<QuickReplyPayload | null> => {
    if (window.electronAPI && (window.electronAPI as any).getLatestReplySnippet) {
      return await (window.electronAPI as any).getLatestReplySnippet();
    }
    return null;
  },

  onReplyConfirmHotkey: (callback: () => void) => {
    if (window.electronAPI && (window.electronAPI as any).onReplyConfirmHotkey) {
      return (window.electronAPI as any).onReplyConfirmHotkey(callback);
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

  // LAN Auto-Updater
  checkForUpdates: async (): Promise<UpdateCheckResult> => {
    if (window.electronAPI) {
      return await window.electronAPI.checkForUpdates();
    }
    return { hasUpdate: false, currentVersion: '1.0.1' };
  },

  downloadAndApplyUpdate: async (downloadUrl: string): Promise<boolean> => {
    if (window.electronAPI) {
      return await window.electronAPI.downloadAndApplyUpdate(downloadUrl);
    }
    return false;
  },

  onUpdateDownloadProgress: (callback: (pct: number) => void) => {
    if (window.electronAPI) {
      return window.electronAPI.onUpdateDownloadProgress(callback);
    }
    return () => {};
  },

  getAppVersion: async (): Promise<string> => {
    if (window.electronAPI) {
      return await window.electronAPI.getAppVersion();
    }
    return '1.0.1';
  },

  openSettingsWindow: (tab?: string) => {
    if (window.electronAPI) {
      window.electronAPI.openSettingsWindow(tab);
    }
  },

  onSwitchSettingsTab: (callback: (tab: string) => void) => {
    if (window.electronAPI && (window.electronAPI as any).onSwitchSettingsTab) {
      return (window.electronAPI as any).onSwitchSettingsTab(callback);
    }
    return () => {};
  },
};
