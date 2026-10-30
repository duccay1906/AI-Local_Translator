import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Copy,
  Check,
  Pin,
  X,
  RotateCw,
  Volume2,
  VolumeX,
  Briefcase,
  Sparkles,
  Smile,
  MessageSquarePlus,
  AlertCircle,
  CornerDownLeft,
} from 'lucide-react';
import { api } from '../services/api';
import { ReplyTone } from '../types';

const OUTGOING_LANGUAGES = [
  'Korean',
  'English',
  'Japanese',
  'Chinese (Simplified)',
  'Vietnamese',
  'French',
  'German',
  'Spanish',
  'Russian',
];

const TONE_OPTIONS: { id: ReplyTone; label: string; icon: React.ReactNode; desc: string }[] = [
  {
    id: 'polite',
    label: 'Polite / Business',
    icon: <Briefcase size={12} />,
    desc: 'Formal & respectful tone (Honorifics for KR/JP)',
  },
  {
    id: 'standard',
    label: 'Standard',
    icon: <Sparkles size={12} />,
    desc: 'Clear & natural everyday communication',
  },
  {
    id: 'casual',
    label: 'Casual',
    icon: <Smile size={12} />,
    desc: 'Friendly & relaxed for close colleagues',
  },
];

export const QuickReplyDialog: React.FC = () => {
  const [sourceText, setSourceText] = useState<string>('');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [targetLanguage, setTargetLanguage] = useState<string>('Korean');
  const [tone, setTone] = useState<ReplyTone>('polite');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const sourceInputRef = useRef<HTMLTextAreaElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTranslatedKeyRef = useRef<string>('');
  const translatedTextRef = useRef<string>('');
  const isStreamingRef = useRef<boolean>(false);
  const pendingAutoReplaceRef = useRef<boolean>(false);

  useEffect(() => {
    translatedTextRef.current = translatedText;
  }, [translatedText]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const triggerTranslation = (textToTranslate: string, lang: string, selectedTone: ReplyTone) => {
    const trimmed = textToTranslate.trim();
    pendingAutoReplaceRef.current = false;
    if (!trimmed) {
      api.cancelReplyTranslation();
      setTranslatedText('');
      setIsStreaming(false);
      setErrorMessage(null);
      return;
    }

    const requestKey = `${trimmed}::${lang}::${selectedTone}`;
    lastTranslatedKeyRef.current = requestKey;

    setTranslatedText('');
    setErrorMessage(null);
    setIsStreaming(true);

    api.startReplyTranslation({
      text: trimmed,
      targetLang: lang,
      tone: selectedTone,
    });
  };

  useEffect(() => {
    // Pull latest snippet on initial mount (cold-boot resilience)
    api.getLatestReplySnippet().then((data) => {
      if (data) {
        if (data.targetLanguage) setTargetLanguage(data.targetLanguage);
        if (data.tone) setTone(data.tone);
        if (data.sourceText) {
          setSourceText(data.sourceText);
          setIsStreaming(true);
        } else {
          setTimeout(() => sourceInputRef.current?.focus(), 50);
        }
      }
    });

    const cleanupInit = api.onInitQuickReply((data) => {
      const lang = data.targetLanguage || targetLanguage || 'Korean';
      const activeTone = data.tone || tone || 'polite';
      pendingAutoReplaceRef.current = false;
      setTargetLanguage(lang);
      setTone(activeTone);
      setSourceText(data.sourceText || '');
      setTranslatedText('');
      translatedTextRef.current = '';
      setErrorMessage(null);

      if (data.sourceText && data.sourceText.trim()) {
        setIsStreaming(true);
        isStreamingRef.current = true;
        lastTranslatedKeyRef.current = `${data.sourceText.trim()}::${lang}::${activeTone}`;
      } else {
        setIsStreaming(false);
        isStreamingRef.current = false;
        setTimeout(() => sourceInputRef.current?.focus(), 50);
      }
    });

    const cleanupChunk = api.onReplyTranslateChunk((chunk) => {
      setTranslatedText((prev) => {
        const next = prev + chunk;
        translatedTextRef.current = next;
        return next;
      });
      setIsStreaming(true);
      isStreamingRef.current = true;
    });

    const cleanupComplete = api.onReplyTranslateComplete((fullText) => {
      setTranslatedText(fullText);
      translatedTextRef.current = fullText;
      setIsStreaming(false);
      isStreamingRef.current = false;
      setErrorMessage(null);

      if (pendingAutoReplaceRef.current && fullText.trim()) {
        pendingAutoReplaceRef.current = false;
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        api.confirmReplyReplace(fullText.trim());
      }
    });

    const cleanupError = api.onReplyTranslateError((err) => {
      pendingAutoReplaceRef.current = false;
      setErrorMessage(err);
      setIsStreaming(false);
      isStreamingRef.current = false;
    });

    const cleanupConfirmHotkey = api.onReplyConfirmHotkey(() => {
      const currentText = translatedTextRef.current.trim();
      if (currentText && !isStreamingRef.current) {
        if (window.speechSynthesis) {
          window.speechSynthesis.cancel();
        }
        api.confirmReplyReplace(currentText);
      } else if (isStreamingRef.current) {
        // User pressed Enter while still streaming -> auto-replace as soon as stream completes
        pendingAutoReplaceRef.current = true;
      }
    });

    return () => {
      cleanupInit();
      cleanupChunk();
      cleanupComplete();
      cleanupError();
      cleanupConfirmHotkey();
    };
  }, []);

  // Global keyboard handler: Enter to Replace, Escape to Close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }

      // Press Enter (without Shift/Ctrl/Alt) to immediately Replace in Chat if translation is ready
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        if (translatedText.trim() && !isStreaming) {
          e.preventDefault();
          handleReplaceInChat();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [translatedText, isStreaming]);

  const handleSourceTextChange = (newText: string) => {
    setSourceText(newText);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!newText.trim()) {
      api.cancelReplyTranslation();
      setTranslatedText('');
      setIsStreaming(false);
      setErrorMessage(null);
      return;
    }

    // Auto-detect pause in typing (450ms) and stream translation
    debounceTimerRef.current = setTimeout(() => {
      triggerTranslation(newText, targetLanguage, tone);
    }, 450);
  };

  const handleLanguageChange = (newLang: string) => {
    setTargetLanguage(newLang);
    if (sourceText.trim()) {
      triggerTranslation(sourceText, newLang, tone);
    }
  };

  const handleToneChange = (newTone: ReplyTone) => {
    setTone(newTone);
    if (sourceText.trim()) {
      triggerTranslation(sourceText, targetLanguage, newTone);
    }
  };

  const handleReplaceInChat = () => {
    const finalOutput = translatedText.trim();
    if (!finalOutput) return;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    api.confirmReplyReplace(finalOutput);
  };

  const handleCopy = () => {
    if (!translatedText.trim()) return;
    api.copyToClipboard(translatedText.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (!translatedText.trim() || !window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(translatedText.trim());
    if (targetLanguage === 'Korean') utterance.lang = 'ko-KR';
    else if (targetLanguage === 'English') utterance.lang = 'en-US';
    else if (targetLanguage === 'Japanese') utterance.lang = 'ja-JP';
    else if (targetLanguage === 'Chinese (Simplified)') utterance.lang = 'zh-CN';
    else if (targetLanguage === 'Vietnamese') utterance.lang = 'vi-VN';
    else if (targetLanguage === 'French') utterance.lang = 'fr-FR';
    else if (targetLanguage === 'German') utterance.lang = 'de-DE';

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleTogglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    api.setReplyPinned(next);
  };

  const handleClose = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    api.closeReplyDialog();
  };

  return (
    <div
      className="glass-panel"
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(11, 15, 25, 0.96)',
        border: '1px solid rgba(99, 102, 241, 0.35)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Top Header Bar */}
      <div
        className="drag-region"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(18, 24, 38, 0.95)',
          borderBottom: '1px solid var(--glass-border)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} className="no-drag">
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)',
            }}
          >
            <MessageSquarePlus size={13} color="#fff" />
          </div>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>
            Quick Chat Reply
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: '10px',
              background: isStreaming ? 'rgba(99, 102, 241, 0.25)' : 'rgba(16, 185, 129, 0.2)',
              color: isStreaming ? '#a5b4fc' : '#6ee7b7',
              border: isStreaming ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)',
            }}
          >
            {isStreaming ? 'Translating...' : 'Ready'}
          </span>
        </div>

        {/* Language & Window Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="no-drag">
          <select
            className="form-select"
            value={targetLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={{
              width: 'auto',
              padding: '3px 8px',
              height: '26px',
              fontSize: '11px',
              fontWeight: 600,
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid rgba(99, 102, 241, 0.4)',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
            }}
            title="Outgoing Target Language"
          >
            {OUTGOING_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                → {lang}
              </option>
            ))}
          </select>

          <button
            className={`btn-icon ${isPinned ? 'active' : ''}`}
            onClick={handleTogglePin}
            title={isPinned ? 'Unpin Window' : 'Pin Always on Top'}
            style={{ width: '26px', height: '26px' }}
          >
            <Pin size={13} />
          </button>

          <button
            className="btn-icon"
            onClick={handleClose}
            title="Cancel (Esc)"
            style={{ width: '26px', height: '26px' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tone Selector Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          background: 'rgba(15, 23, 42, 0.75)',
          borderBottom: '1px solid var(--glass-border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', marginRight: '2px' }}>
          Tone:
        </span>
        {TONE_OPTIONS.map((t) => {
          const active = tone === t.id;
          return (
            <button
              key={t.id}
              onClick={() => handleToneChange(t.id)}
              title={t.desc}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 9px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: active ? 'rgba(99, 102, 241, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                color: active ? '#c7d2fe' : 'var(--text-muted)',
                border: active ? '1px solid rgba(99, 102, 241, 0.55)' : '1px solid transparent',
              }}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '10px 12px',
          gap: '10px',
          overflowY: 'auto',
        }}
      >
        {/* Source Message Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Your Message (Type or Edit — Auto Translates)
            </span>
            {sourceText && (
              <button
                onClick={() => handleSourceTextChange('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-dim)',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
          </div>
          <textarea
            ref={sourceInputRef}
            value={sourceText}
            onChange={(e) => handleSourceTextChange(e.target.value)}
            placeholder="Type your message here (Shift+Enter for new line)..."
            rows={2}
            className="selectable"
            style={{
              width: '100%',
              resize: 'none',
              background: 'rgba(15, 23, 42, 0.7)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 10px',
              color: 'var(--text-main)',
              fontSize: '13px',
              lineHeight: '1.45',
              outline: 'none',
            }}
          />
        </div>

        {/* Translation Preview Output (Editable) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Translation Preview ({targetLanguage})
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                className={`btn-icon ${isSpeaking ? 'active' : ''}`}
                onClick={handleSpeak}
                disabled={!translatedText.trim()}
                title="Listen Pronunciation"
                style={{ width: '22px', height: '22px' }}
              >
                {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
              </button>
              <button
                className="btn-icon"
                onClick={() => triggerTranslation(sourceText, targetLanguage, tone)}
                disabled={!sourceText.trim() || isStreaming}
                title="Re-translate"
                style={{ width: '22px', height: '22px' }}
              >
                <RotateCw size={12} className={isStreaming ? 'spin' : ''} />
              </button>
            </div>
          </div>

          {errorMessage ? (
            <div
              style={{
                flex: 1,
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px',
                color: '#fca5a5',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={15} color="#ef4444" />
              <span>{errorMessage}</span>
            </div>
          ) : isStreaming && !translatedText ? (
            <div
              style={{
                flex: 1,
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'var(--text-dim)',
                fontSize: '12.5px',
                fontStyle: 'italic',
              }}
            >
              <RotateCw size={14} className="spin" color="var(--accent-primary)" />
              <span>Translating, please wait...</span>
            </div>
          ) : (
            <textarea
              value={translatedText}
              onChange={(e) => setTranslatedText(e.target.value)}
              placeholder="Translated preview will appear here..."
              className="selectable"
              style={{
                flex: 1,
                width: '100%',
                resize: 'none',
                background: 'rgba(99, 102, 241, 0.07)',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                borderRadius: 'var(--radius-sm)',
                padding: '9px 10px',
                color: '#fff',
                fontSize: '13.5px',
                fontWeight: 500,
                lineHeight: '1.5',
                outline: 'none',
              }}
            />
          )}
        </div>
      </div>

      {/* Bottom Action Footer */}
      <div
        style={{
          padding: '8px 12px',
          background: 'rgba(18, 24, 38, 0.95)',
          borderTop: '1px solid var(--glass-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>
            Press <kbd style={{ background: '#1e293b', padding: '1px 5px', borderRadius: '4px', border: '1px solid #334155', color: '#e2e8f0' }}>Enter</kbd> to Replace
          </span>
          <span>•</span>
          <span>
            <kbd style={{ background: '#1e293b', padding: '1px 5px', borderRadius: '4px', border: '1px solid #334155', color: '#e2e8f0' }}>Esc</kbd> Cancel
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            className={`btn-icon ${copied ? 'active' : ''}`}
            onClick={handleCopy}
            disabled={!translatedText.trim()}
            title="Copy Translation Only"
            style={{ width: '28px', height: '28px' }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>

          <button
            className="btn-primary"
            onClick={handleReplaceInChat}
            disabled={!translatedText.trim() || isStreaming}
            style={{
              height: '28px',
              padding: '0 12px',
              fontSize: '12px',
              gap: '6px',
              opacity: !translatedText.trim() || isStreaming ? 0.5 : 1,
            }}
          >
            <CornerDownLeft size={13} />
            <span>Replace in Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
