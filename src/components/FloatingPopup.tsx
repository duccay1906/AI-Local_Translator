import React, { useState, useEffect } from 'react';
import { marked } from 'marked';
import { api } from '../services/api';
import { AppSettings, VisualTranslationPayload } from '../types';
import { VisualTranslateViewer } from './VisualTranslateViewer';
import { 
  Pin, 
  X, 
  Copy, 
  Check, 
  Volume2, 
  RotateCw, 
  Settings, 
  Sparkles, 
  ChevronDown, 
  ChevronUp,
  AlertTriangle,
  Eye,
  ScanText,
  Image as ImageIcon,
  FileText,
  ArrowUpCircle
} from 'lucide-react';

const SUPPORTED_LANGUAGES = [
  'Vietnamese',
  'English',
  'Japanese',
  'Korean',
  'Chinese (Simplified)',
  'French',
  'German',
  'Spanish',
  'Russian',
];

export const FloatingPopup: React.FC = () => {
  const [sourceText, setSourceText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [targetLang, setTargetLang] = useState<string>('Vietnamese');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [showSource, setShowSource] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [visualData, setVisualData] = useState<VisualTranslationPayload | null>(null);
  const [viewMode, setViewMode] = useState<'visual' | 'text'>('visual');

  const [popupOpacity, setPopupOpacity] = useState<number>(0.92);
  const [showOpacitySlider, setShowOpacitySlider] = useState<boolean>(false);
  const [hasUpdate, setHasUpdate] = useState<boolean>(false);

  const targetLangRef = React.useRef<string>(targetLang);

  // Keep targetLangRef in sync with targetLang state
  useEffect(() => {
    targetLangRef.current = targetLang;
  }, [targetLang]);

  useEffect(() => {
    // Check for updates quietly in background
    api.checkForUpdates().then((res) => {
      if (res.hasUpdate) {
        setHasUpdate(true);
      }
    }).catch(() => {});

    // Load current settings ONCE on mount
    api.getSettings().then((res) => {
      setSettings(res);
      if (res.targetLanguage) {
        setTargetLang(res.targetLanguage);
        targetLangRef.current = res.targetLanguage;
      }
      if (res.opacity !== undefined) {
        setPopupOpacity(res.opacity);
      }
    });

    // Listen for OCR state updates (when user snips an image region)
    const cleanupOcrState = api.onOcrStateChange((state) => {
      if (state.status === 'processing') {
        setOcrStatus('Translating, please wait...');
        setErrorMessage(null);
        setSourceText('');
        setTranslatedText('');
        setIsLoading(false);
        if (state.imagePreview) {
          setImagePreview(state.imagePreview);
        }
      } else if (state.status === 'done') {
        setOcrStatus(null);
      } else if (state.status === 'error') {
        setOcrStatus(null);
        setIsLoading(false);
        setErrorMessage(state.message || 'Could not extract text from the selected image.');
      }
    });

    // Listen for translation trigger from main process (hotkey F8, or selection)
    const cleanupTrigger = api.onTriggerTranslate((data) => {
      setOcrStatus(null);
      setVisualData(null);
      setViewMode('text');
      setSourceText(data.text);
      setImagePreview(null);
      setTranslatedText('');
      setErrorMessage(null);
      setIsLoading(true);
      api.resizePopup(440, 320);
      api.translateText(data.text, targetLangRef.current);
    });

    // Listen for in-place visual translation with bounding boxes
    const cleanupVisual = api.onTriggerVisualTranslate((data) => {
      setOcrStatus(null);
      setVisualData(data);
      setViewMode('visual');
      setSourceText(data.fullOriginalText);
      setTranslatedText(data.fullTranslatedText);
      setImagePreview(data.imagePreview);
      setIsLoading(false);
      // Automatically expand window slightly for comfortable visual viewing
      api.resizePopup(520, 420);
    });

    // Listen for stream chunks
    const cleanupChunk = api.onTranslateChunk((chunk) => {
      setIsLoading(false);
      setTranslatedText((prev) => prev + chunk);
    });

    // Listen for completion
    const cleanupComplete = api.onTranslateComplete((fullText) => {
      setIsLoading(false);
      setTranslatedText(fullText);
    });

    // Listen for errors
    const cleanupError = api.onTranslateError((err) => {
      setIsLoading(false);
      setErrorMessage(err);
    });

    return () => {
      cleanupOcrState();
      cleanupTrigger();
      cleanupVisual();
      cleanupChunk();
      cleanupComplete();
      cleanupError();
    };
  }, []);

  // Listen for window focus loss (click outside popup) to automatically close unless pinned
  useEffect(() => {
    const handleBlur = () => {
      if (!isPinned) {
        api.closePopup();
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('blur', handleBlur);
    };
  }, [isPinned]);

  // Close popup when Esc key is pressed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape') {
        api.closePopup();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setTargetLang(newLang);
    if (sourceText) {
      setTranslatedText('');
      setErrorMessage(null);
      setIsLoading(true);
      api.translateText(sourceText, newLang);
    }
  };

  const handleRegenerate = () => {
    if (sourceText) {
      setTranslatedText('');
      setErrorMessage(null);
      setIsLoading(true);
      api.translateText(sourceText, targetLang);
    }
  };

  const handleCopy = () => {
    if (translatedText) {
      api.copyToClipboard(translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSpeak = () => {
    if ('speechSynthesis' in window && translatedText) {
      window.speechSynthesis.cancel(); // stop active utterance
      const utterance = new SpeechSynthesisUtterance(translatedText);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const togglePin = () => {
    const nextPinState = !isPinned;
    setIsPinned(nextPinState);
    api.setPinned(nextPinState);
  };

  const handleClose = () => {
    api.closePopup();
  };

  const isSolid = popupOpacity >= 0.99;

  return (
    <div 
      style={{ 
        width: '100%', 
        height: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        backgroundColor: isSolid ? '#0b0f19' : `rgba(15, 23, 42, ${popupOpacity})`,
        backdropFilter: isSolid ? 'none' : `blur(${popupOpacity * 16}px)`,
        WebkitBackdropFilter: isSolid ? 'none' : `blur(${popupOpacity * 16}px)`,
        border: isSolid ? '1px solid #1e293b' : '1px solid var(--glass-border)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        transition: 'background-color 0.15s ease, backdrop-filter 0.15s ease'
      }}
    >
      {/* Header Bar */}
      <div 
        className="drag-region"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: isSolid ? '#05080f' : 'rgba(11, 15, 25, 0.5)',
          borderBottom: isSolid ? '1px solid #1e293b' : '1px solid var(--glass-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="var(--accent-primary)" />
          <span style={{ fontSize: '13px', fontWeight: 700 }} className="gradient-text">
            AI Translate
          </span>
          <span className="pulse-dot" title="AI Ready" />
        </div>

        {/* Controls */}
        <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Mode Switcher when Visual Translation / Image is available */}
          {(visualData || imagePreview) && (
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                background: 'rgba(15, 23, 42, 0.9)', 
                borderRadius: '6px', 
                padding: '2px', 
                border: '1px solid rgba(99, 102, 241, 0.4)',
                marginRight: '2px'
              }}
            >
              <button
                type="button"
                className={`btn-icon ${viewMode === 'visual' ? 'active' : ''}`}
                onClick={() => setViewMode('visual')}
                title="Visual In-place Translation (Ảnh đè chữ)"
                style={{ height: '22px', padding: '0 8px', fontSize: '11px', gap: '4px', fontWeight: 600 }}
              >
                <ImageIcon size={12} color="var(--accent-primary)" /> Visual
              </button>
              <button
                type="button"
                className={`btn-icon ${viewMode === 'text' ? 'active' : ''}`}
                onClick={() => setViewMode('text')}
                title="Text Only View (Văn bản thuần)"
                style={{ height: '22px', padding: '0 8px', fontSize: '11px', gap: '4px', fontWeight: 600 }}
              >
                <FileText size={12} /> Text
              </button>
            </div>
          )}

          {/* Target Language Select */}
          <select 
            className="form-select" 
            value={targetLang} 
            onChange={handleLanguageChange}
            style={{ width: 'auto', padding: '3px 8px', fontSize: '11px', height: '26px' }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>

          {/* Opacity Control Slider Popover */}
          {showOpacitySlider && (
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                background: isSolid ? '#0f172a' : 'rgba(11, 15, 25, 0.9)', 
                padding: '2px 8px', 
                borderRadius: 'var(--radius-sm)', 
                border: isSolid ? '1px solid #334155' : '1px solid var(--glass-border)' 
              }}
            >
              <Eye size={12} color="var(--text-muted)" />
              <input 
                type="range" 
                min="0.30" 
                max="1.0" 
                step="0.05" 
                value={popupOpacity}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setPopupOpacity(val);
                  if (settings) {
                    api.saveSettings({ ...settings, opacity: val });
                  }
                }}
                style={{ width: '60px', height: '4px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', width: '26px' }}>
                {Math.round(popupOpacity * 100)}%
              </span>
            </div>
          )}

          <button 
            className={`btn-icon ${showOpacitySlider ? 'active' : ''}`}
            onClick={() => setShowOpacitySlider(!showOpacitySlider)}
            title="Adjust Window Opacity (Transparency)"
            style={{ width: '26px', height: '26px' }}
          >
            <Eye size={13} />
          </button>

          {/* Screen OCR Snip Button */}
          <button 
            className="btn-icon"
            onClick={() => api.startOcrCapture()}
            title={`Screen OCR Translate (${settings?.ocrHotkey || 'F9'})`}
            style={{ width: '26px', height: '26px' }}
          >
            <ScanText size={13} />
          </button>

          {/* Pin Button */}
          <button 
            className={`btn-icon ${isPinned ? 'active' : ''}`}
            onClick={togglePin}
            title={isPinned ? 'Unpin Window' : 'Pin Always on Top'}
            style={{ width: '26px', height: '26px' }}
          >
            <Pin size={13} />
          </button>

          {/* Check for Updates Button */}
          <button 
            className="btn-icon"
            onClick={() => api.openSettingsWindow('updates')}
            title={hasUpdate ? "New Update Available! Click to update" : "Check for Updates"}
            style={{ width: '26px', height: '26px', position: 'relative' }}
          >
            <ArrowUpCircle size={14} color={hasUpdate ? "#10b981" : "var(--accent-primary)"} />
            {hasUpdate && (
              <span 
                style={{
                  position: 'absolute',
                  top: '3px',
                  right: '3px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                  boxShadow: '0 0 6px #10b981',
                }}
              />
            )}
          </button>

          {/* Settings Button */}
          <button 
            className="btn-icon"
            onClick={() => api.openSettingsWindow()}
            title="Open Settings"
            style={{ width: '26px', height: '26px' }}
          >
            <Settings size={13} />
          </button>

          {/* Close Button */}
          <button 
            className="btn-icon"
            onClick={handleClose}
            title="Close"
            style={{ width: '26px', height: '26px' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Main Translation Content */}
      <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {/* If in Visual Mode with blocks, display the Visual In-place Canvas Viewer */}
        {visualData && viewMode === 'visual' ? (
          <VisualTranslateViewer
            imagePreview={visualData.imagePreview}
            blocks={visualData.blocks}
            targetLanguage={targetLang}
          />
        ) : (
          <>
            {/* Source Text / Captured Image Preview (Collapsible) */}
            {(sourceText || imagePreview) && (
              <div 
                style={{ 
                  background: isSolid ? '#0f172a' : 'rgba(255, 255, 255, 0.03)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: '8px 10px',
                  border: isSolid ? '1px solid #1e293b' : '1px solid rgba(255, 255, 255, 0.05)',
                  fontSize: '12px',
                  color: 'var(--text-muted)'
                }}
              >
                <div 
                  onClick={() => setShowSource(!showSource)} 
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {imagePreview && <ScanText size={12} color="var(--accent-primary)" />}
                    {sourceText ? `Source Text (${sourceText.length} chars)` : 'Captured Image (OCR...)'}
                  </span>
                  {showSource ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
                
                {showSource && (
                  <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {imagePreview && (
                      <div style={{ maxHeight: '64px', overflow: 'hidden', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)', background: '#05080f', display: 'flex', justifyContent: 'center' }}>
                        <img src={imagePreview} alt="Snipped OCR region" style={{ maxHeight: '64px', maxWidth: '100%', objectFit: 'contain' }} />
                      </div>
                    )}
                    {sourceText && (
                      <div 
                        className="selectable"
                        style={{ 
                          maxHeight: '60px', 
                          overflowY: 'auto', 
                          whiteSpace: 'pre-wrap', 
                          color: 'var(--text-main)',
                          fontSize: '12px',
                          lineHeight: '1.4',
                          userSelect: 'text',
                          WebkitUserSelect: 'text'
                        }}
                      >
                        {sourceText}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Translation Result Output */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {errorMessage ? (
                <div 
                  style={{ 
                    background: 'rgba(239, 68, 68, 0.1)', 
                    border: '1px solid rgba(239, 68, 68, 0.3)', 
                    borderRadius: 'var(--radius-md)', 
                    padding: '12px', 
                    color: '#fca5a5',
                    fontSize: '12px',
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start'
                  }}
                >
                  <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>Translation / OCR Notice</strong>
                    <p style={{ margin: 0, lineHeight: '1.4' }}>{errorMessage}</p>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button 
                        className="btn-primary" 
                        onClick={() => api.startOcrCapture()}
                        style={{ padding: '4px 10px', fontSize: '11px' }}
                      >
                        <ScanText size={12} /> Resnip Image
                      </button>
                      <button 
                        className="btn-icon" 
                        onClick={() => api.openSettingsWindow()}
                        style={{ width: 'auto', padding: '4px 10px', fontSize: '11px' }}
                      >
                        <Settings size={12} /> Settings
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div 
                  className={`selectable ${(isLoading || ocrStatus) ? 'typing-indicator' : ''}`}
                  style={{ 
                    flex: 1, 
                    minHeight: '100px', 
                    fontSize: '13.5px', 
                    lineHeight: '1.55', 
                    color: 'var(--text-main)', 
                    whiteSpace: 'pre-wrap',
                    background: isSolid ? '#0e1422' : 'rgba(11, 15, 25, 0.5)',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    border: isSolid ? '1px solid #1e293b' : '1px solid var(--glass-border)',
                    userSelect: 'text',
                    WebkitUserSelect: 'text',
                    cursor: 'text'
                  }}
                >
                  {ocrStatus ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)', fontStyle: 'italic' }}>
                      <RotateCw size={14} className="spin" />
                      <span>{ocrStatus}</span>
                    </div>
                  ) : translatedText ? (
                    <div
                      className="markdown-preview selectable"
                      dangerouslySetInnerHTML={{ __html: marked.parse(translatedText) as string }}
                    />
                  ) : isLoading ? (
                    <span style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>Translating, please wait...</span>
                  ) : (
                    <span style={{ color: 'var(--text-dim)' }}>
                      Press <kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', border: '1px solid #334155' }}>{settings?.hotkey || 'F8'}</kbd> to translate selected text, or <kbd style={{ background: '#1e293b', padding: '2px 6px', borderRadius: '4px', border: '1px solid #334155' }}>{settings?.ocrHotkey || 'F9'}</kbd> to snip & translate from an image.
                    </span>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Action Footer */}
      <div 
        style={{
          padding: '8px 12px',
          background: 'rgba(11, 15, 25, 0.6)',
          borderTop: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Copy Button */}
          <button 
            className={`btn-icon ${copied ? 'active' : ''}`}
            onClick={handleCopy}
            disabled={!translatedText}
            title="Copy Translation"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>

          {/* Text to Speech */}
          <button 
            className="btn-icon" 
            onClick={handleSpeak}
            disabled={!translatedText}
            title="Listen Read Aloud"
          >
            <Volume2 size={14} />
          </button>

          {/* Regenerate */}
          <button 
            className="btn-icon" 
            onClick={handleRegenerate}
            disabled={isLoading || !sourceText}
            title="Re-translate"
          >
            <RotateCw size={14} className={isLoading ? 'spin' : ''} />
          </button>
        </div>

        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
          {translatedText ? `${translatedText.split(/\s+/).filter(Boolean).length} words` : 'AI Translate'}
        </span>
      </div>
    </div>
  );
};
