export type TriggerMode = 'hotkey' | 'auto_selection' | 'both';
export type AppTheme = 'dark' | 'light' | 'glass';

export interface AppSettings {
  lmStudioUrl: string;
  modelName: string;
  targetLanguage: string;
  systemPrompt: string;
  triggerMode: TriggerMode;
  hotkey: string;
  autoCopySelection: boolean;
  theme: AppTheme;
  opacity?: number;
}

export interface TranslationHistoryItem {
  id: string;
  originalText: string;
  translatedText: string;
  targetLanguage: string;
  timestamp: number;
}

export interface LMStudioModel {
  id: string;
  object: string;
  owned_by?: string;
}

export interface DirectTranslateOptions {
  text: string;
  targetLang?: string;
}

// Window state IPC communication
export interface WindowPosition {
  x: number;
  y: number;
}
