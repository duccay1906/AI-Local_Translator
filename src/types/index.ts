export type TriggerMode = 'hotkey' | 'auto_selection' | 'both';
export type AppTheme = 'dark' | 'light' | 'glass';
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export interface AppSettings {
  lmStudioUrl: string;
  modelName: string;
  targetLanguage: string;
  systemPrompt: string;
  triggerMode: TriggerMode;
  hotkey: string;
  ocrHotkey?: string;
  ocrLanguage?: string;
  reasoningEffort?: ReasoningEffort;
  autoStartWithWindows?: boolean;
  autoCopySelection: boolean;
  theme: AppTheme;
  opacity?: number;
}

export interface SnipCapturePayload {
  scaleFactor: number;
  ocrLanguage: string;
  displayBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SnipSelectionResult {
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  viewportWidth: number;
  viewportHeight: number;
  ocrLanguage: string;
  screenX: number;
  screenY: number;
}

export interface OcrStatePayload {
  status: 'processing' | 'done' | 'error';
  message?: string;
  imagePreview?: string;
}

export interface BoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrTextBlock {
  id: number;
  bbox: BoundingBox;
  text: string;
  confidence: number;
}

export interface VisualBlockTranslation {
  id: number;
  bbox: BoundingBox;
  originalText: string;
  translatedText: string;
}

export interface VisualTranslationPayload {
  imagePreview: string;
  blocks: VisualBlockTranslation[];
  fullOriginalText: string;
  fullTranslatedText: string;
  targetLanguage: string;
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
