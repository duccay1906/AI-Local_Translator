import React, { useState, useEffect, useRef } from 'react';
import {
  Copy,
  Check,
  Download,
  Sparkles,
  Pin,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  RotateCw,
  AlertCircle,
  FileImage,
  MessageSquare,
} from 'lucide-react';
import { api } from '../services/api';

const SUPPORTED_LANGUAGES = [
  'Vietnamese',
  'English',
  'Korean',
  'Japanese',
  'Chinese (Simplified)',
  'French',
  'German',
  'Spanish',
  'Russian',
];

export const OcrDialog: React.FC = () => {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState<string>('Vietnamese');
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(100);
  const [fitMode, setFitMode] = useState<'fit' | 'original'>('fit');
  const [imageSize, setImageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const textContainerRef = useRef<HTMLDivElement | null>(null);

  // Setup IPC listeners
  useEffect(() => {
    // 1. New Multimodal Vision Events
    const cleanupInit = api.onInitVisionTranslate((data) => {
      setImagePreview(data.imagePreview);
      if (data.targetLanguage) setTargetLanguage(data.targetLanguage);
      setTranslatedText('');
      setErrorMessage(null);
      setIsStreaming(true);
    });

    const cleanupChunk = api.onVisionTranslateChunk((chunk) => {
      setTranslatedText((prev) => prev + chunk);
      setIsStreaming(true);
      // Auto-scroll to bottom while streaming
      if (textContainerRef.current) {
        textContainerRef.current.scrollTop = textContainerRef.current.scrollHeight;
      }
    });

    const cleanupComplete = api.onVisionTranslateComplete((fullText) => {
      setTranslatedText(fullText);
      setIsStreaming(false);
      setErrorMessage(null);
    });

    const cleanupError = api.onVisionTranslateError((err) => {
      setErrorMessage(err);
      setIsStreaming(false);
    });

    // Backwards compatibility listeners (in case old event is dispatched)
    const cleanupVisual = api.onTriggerVisualTranslate((data) => {
      setImagePreview(data.imagePreview);
      if (data.fullTranslatedText) {
        setTranslatedText(data.fullTranslatedText);
      }
      setIsStreaming(false);
    });

    const cleanupOcrState = api.onOcrStateChange((state) => {
      if (state.imagePreview) {
        setImagePreview(state.imagePreview);
      }
      if (state.status === 'error' && state.message) {
        setErrorMessage(state.message);
        setIsStreaming(false);
      }
    });

    return () => {
      cleanupInit();
      cleanupChunk();
      cleanupComplete();
      cleanupError();
      cleanupVisual();
      cleanupOcrState();
    };
  }, []);

  // Update image natural dimensions when image loads
  useEffect(() => {
    if (!imagePreview) return;
    const img = new Image();
    img.src = imagePreview;
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
  }, [imagePreview]);

  // Handle window blur (close if unpinned)
  useEffect(() => {
    const handleBlur = () => {
      if (!isPinned) {
        api.closeOcrDialog();
      }
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [isPinned]);

  // Handle Esc key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        api.closeOcrDialog();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTogglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    api.setOcrPinned(next);
  };

  const handleClose = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    api.closeOcrDialog();
  };

  const handleCopyText = () => {
    if (!translatedText) return;
    api.copyToClipboard(translatedText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleCopyImage = async () => {
    if (!imagePreview) return;
    try {
      const res = await fetch(imagePreview);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type]: blob }),
      ]);
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    } catch {
      api.copyToClipboard(imagePreview);
      setCopiedImage(true);
      setTimeout(() => setCopiedImage(false), 2000);
    }
  };

  const handleDownloadImage = () => {
    if (!imagePreview) return;
    const link = document.createElement('a');
    link.href = imagePreview;
    link.download = `Vision_Translate_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSpeak = () => {
    if (!translatedText || !window.speechSynthesis) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(translatedText);

    if (targetLanguage === 'Vietnamese') utterance.lang = 'vi-VN';
    else if (targetLanguage === 'English') utterance.lang = 'en-US';
    else if (targetLanguage === 'Korean') utterance.lang = 'ko-KR';
    else if (targetLanguage === 'Japanese') utterance.lang = 'ja-JP';
    else if (targetLanguage === 'Chinese (Simplified)') utterance.lang = 'zh-CN';
    else if (targetLanguage === 'French') utterance.lang = 'fr-FR';
    else if (targetLanguage === 'German') utterance.lang = 'de-DE';

    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  const handleRetry = () => {
    if (!imagePreview) return;
    setTranslatedText('');
    setErrorMessage(null);
    setIsStreaming(true);
    api.startVisionTranslation({
      imageBase64: imagePreview,
      targetLang: targetLanguage,
    });
  };

  const handleLanguageChange = (newLang: string) => {
    setTargetLanguage(newLang);
    if (!imagePreview) return;
    setTranslatedText('');
    setErrorMessage(null);
    setIsStreaming(true);
    api.startVisionTranslation({
      imageBase64: imagePreview,
      targetLang: newLang,
    });
  };

  // Render nicely formatted conversation / markdown text
  const renderFormattedText = (rawText: string) => {
    if (!rawText) return null;

    const lines = rawText.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();

      // Speaker line: e.g. [Jay (PARK Jong-Ho)] or [Người phản hồi]
      if (/^\[.+\]$/.test(trimmed)) {
        return (
          <div
            key={idx}
            style={{
              fontWeight: 700,
              color: '#818cf8',
              fontSize: '13px',
              marginTop: idx > 0 ? '14px' : '0px',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <MessageSquare size={13} color="#818cf8" />
            <span>{trimmed}</span>
          </div>
        );
      }

      // Timestamp line: e.g. (Thời gian: 5:20 chiều) or (5:31 chiều)
      if (/^\(.*\)$/.test(trimmed) && (trimmed.includes('Thời gian') || trimmed.includes('chiều') || trimmed.includes('sáng') || trimmed.includes(':'))) {
        return (
          <div
            key={idx}
            style={{
              fontSize: '11px',
              color: 'var(--text-dim)',
              fontStyle: 'italic',
              marginBottom: '8px',
              paddingLeft: '2px',
            }}
          >
            {trimmed}
          </div>
        );
      }

      // Empty separator line
      if (!trimmed) {
        return <div key={idx} style={{ height: '8px' }} />;
      }

      // Regular paragraph or dialog text
      return (
        <div
          key={idx}
          style={{
            fontSize: '13px',
            lineHeight: '1.65',
            color: 'var(--text-main)',
            marginBottom: '4px',
            userSelect: 'text',
            WebkitUserSelect: 'text',
          }}
        >
          {line}
        </div>
      );
    });
  };

  const wordCount = translatedText.trim() ? translatedText.trim().split(/\s+/).length : 0;
  const charCount = translatedText.length;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-main)',
        color: 'var(--text-main)',
        overflow: 'hidden',
        border: '1px solid var(--glass-border)',
        boxShadow: 'var(--shadow-popup)',
      }}
    >
      {/* Header Toolbar */}
      <div
        className="drag-region"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          background: 'rgba(18, 24, 38, 0.95)',
          borderBottom: '1px solid var(--glass-border)',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        {/* Left Title & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} className="no-drag">
          <div
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '7px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(99, 102, 241, 0.4)',
              flexShrink: 0,
            }}
          >
            <Sparkles size={14} color="#fff" />
          </div>

          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.01em', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>AI Vision Translator</span>
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
                {isStreaming ? 'Translating...' : 'Multimodal Vision'}
              </span>
            </div>
          </div>
        </div>

        {/* Center / Right Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }} className="no-drag">
          {/* Target Language Dropdown */}
          <select
            className="form-input"
            value={targetLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '4px 8px',
              height: '28px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang} style={{ background: '#1e293b', color: '#fff' }}>
                {lang}
              </option>
            ))}
          </select>

          <div style={{ width: '1px', height: '16px', background: 'var(--glass-border)', margin: '0 4px' }} />

          {/* Copy Translation Text */}
          <button
            className="btn-icon"
            onClick={handleCopyText}
            disabled={!translatedText}
            title="Copy Translation Text"
            style={{ width: '28px', height: '28px' }}
          >
            {copiedText ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
          </button>

          {/* Text-to-Speech (TTS) */}
          <button
            className="btn-icon"
            onClick={handleSpeak}
            disabled={!translatedText}
            title={isSpeaking ? 'Stop Pronunciation' : 'Listen Pronunciation'}
            style={{ width: '28px', height: '28px' }}
          >
            {isSpeaking ? <VolumeX size={14} color="var(--accent-primary)" /> : <Volume2 size={14} />}
          </button>

          {/* Copy Original Image */}
          <button
            className="btn-icon"
            onClick={handleCopyImage}
            disabled={!imagePreview}
            title="Copy Original Image to Clipboard"
            style={{ width: '28px', height: '28px' }}
          >
            {copiedImage ? <Check size={14} color="#10b981" /> : <FileImage size={14} />}
          </button>

          {/* Download Original Image */}
          <button
            className="btn-icon"
            onClick={handleDownloadImage}
            disabled={!imagePreview}
            title="Save Image as PNG"
            style={{ width: '28px', height: '28px' }}
          >
            <Download size={14} />
          </button>

          {/* Retry / Regenerate */}
          <button
            className="btn-icon"
            onClick={handleRetry}
            disabled={isStreaming || !imagePreview}
            title="Re-translate with Vision LLM"
            style={{ width: '28px', height: '28px' }}
          >
            <RotateCw size={14} className={isStreaming ? 'spin-animation' : ''} />
          </button>

          <div style={{ width: '1px', height: '16px', background: 'var(--glass-border)', margin: '0 4px' }} />

          {/* Pin Window */}
          <button
            className={`btn-icon ${isPinned ? 'active' : ''}`}
            onClick={handleTogglePin}
            title={isPinned ? 'Unpin Window' : 'Pin Always on Top'}
            style={{ width: '28px', height: '28px' }}
          >
            <Pin size={14} />
          </button>

          {/* Close Window */}
          <button
            className="btn-icon"
            onClick={handleClose}
            title="Close (Esc)"
            style={{ width: '28px', height: '28px' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Split-View Content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          background: 'rgba(11, 15, 25, 0.7)',
        }}
      >
        {/* Left Column: Original Captured Image */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            borderRight: '1px solid var(--glass-border)',
            background: '#090d16',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subheader: Image Info & Zoom Controls */}
          <div
            style={{
              padding: '6px 12px',
              background: 'rgba(18, 24, 38, 0.8)',
              borderBottom: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-dim)' }}>
              Original Capture {imageSize.width > 0 && `(${imageSize.width} × ${imageSize.height} px)`}
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                className="btn-icon"
                onClick={() => setZoom((z) => Math.max(40, z - 20))}
                title="Zoom Out"
                style={{ width: '22px', height: '22px' }}
              >
                <ZoomOut size={12} />
              </button>
              <span style={{ fontSize: '11px', minWidth: '38px', textAlign: 'center', fontWeight: 600 }}>
                {fitMode === 'fit' ? 'Fit' : `${zoom}%`}
              </span>
              <button
                className="btn-icon"
                onClick={() => {
                  setFitMode('original');
                  setZoom((z) => Math.min(250, z + 20));
                }}
                title="Zoom In"
                style={{ width: '22px', height: '22px' }}
              >
                <ZoomIn size={12} />
              </button>
              <button
                className="btn-icon"
                onClick={() => {
                  if (fitMode === 'fit') {
                    setFitMode('original');
                    setZoom(100);
                  } else {
                    setFitMode('fit');
                  }
                }}
                title={fitMode === 'fit' ? 'View 100% Actual Size' : 'Fit to Window'}
                style={{ width: '22px', height: '22px', marginLeft: '4px' }}
              >
                {fitMode === 'fit' ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
              </button>
            </div>
          </div>

          {/* Image Display Area */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              display: 'flex',
              alignItems: fitMode === 'fit' ? 'center' : 'flex-start',
              justifyContent: fitMode === 'fit' ? 'center' : 'flex-start',
              padding: '16px',
              backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 0)',
              backgroundSize: '16px 16px',
            }}
          >
            {imagePreview ? (
              <img
                src={imagePreview}
                alt="Captured screen snippet"
                style={{
                  maxWidth: fitMode === 'fit' ? '100%' : 'none',
                  maxHeight: fitMode === 'fit' ? '100%' : 'none',
                  width: fitMode === 'original' ? `${(imageSize.width * zoom) / 100}px` : 'auto',
                  height: fitMode === 'original' ? `${(imageSize.height * zoom) / 100}px` : 'auto',
                  objectFit: 'contain',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.1)',
                  transition: 'width 0.15s ease, height 0.15s ease',
                }}
              />
            ) : (
              <div style={{ color: 'var(--text-dim)', fontSize: '12px' }}>
                No image preview available
              </div>
            )}
          </div>
        </div>

        {/* Right Column: AI Vision Translation */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--bg-card)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subheader: Translation Status */}
          <div
            style={{
              padding: '6px 14px',
              background: 'rgba(18, 24, 38, 0.8)',
              borderBottom: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={12} color="var(--accent-primary)" />
              AI Translation Output
            </span>

            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
              {isStreaming ? 'AI is generating...' : `${wordCount} words • ${charCount} chars`}
            </span>
          </div>

          {/* Translation Output Body */}
          <div
            ref={textContainerRef}
            style={{
              flex: 1,
              padding: '18px 20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {/* Error Message */}
            {errorMessage && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  color: '#fca5a5',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: '10px',
                }}
              >
                <AlertCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <strong>Translation Failed:</strong>
                  <div style={{ marginTop: '2px', lineHeight: '1.4' }}>{errorMessage}</div>
                  <button
                    className="btn-secondary"
                    onClick={handleRetry}
                    style={{ marginTop: '8px', fontSize: '11px', padding: '4px 10px' }}
                  >
                    <RotateCw size={12} /> Retry
                  </button>
                </div>
              </div>
            )}

            {/* Formatted Translated Text */}
            {translatedText ? (
              <div style={{ flex: 1 }}>
                {renderFormattedText(translatedText)}
                {isStreaming && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '6px',
                      height: '14px',
                      background: 'var(--accent-primary)',
                      marginLeft: '4px',
                      verticalAlign: 'middle',
                      animation: 'pulse 0.8s infinite',
                    }}
                  />
                )}
              </div>
            ) : isStreaming ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  color: 'var(--text-muted)',
                  gap: '10px',
                }}
              >
                <RotateCw size={22} className="spin-animation" color="var(--accent-primary)" />
                <div style={{ fontSize: '13px', fontWeight: 500 }}>
                  Gemma 4 Vision is analyzing and translating the image...
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  Reading text, conversation flow, timestamps, and context directly from visual input.
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  color: 'var(--text-dim)',
                  fontSize: '13px',
                }}
              >
                Ready for translation
              </div>
            )}
          </div>

          {/* Bottom Action Footer */}
          <div
            style={{
              padding: '8px 14px',
              background: 'rgba(18, 24, 38, 0.9)',
              borderTop: '1px solid var(--glass-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              color: 'var(--text-dim)',
              flexShrink: 0,
            }}
          >
            <span>✨ Powered by LM Studio Multimodal Vision</span>

            <button
              className="btn-primary"
              onClick={handleCopyText}
              disabled={!translatedText}
              style={{
                height: '28px',
                fontSize: '11px',
                padding: '0 12px',
                gap: '6px',
              }}
            >
              {copiedText ? <Check size={13} /> : <Copy size={13} />}
              {copiedText ? 'Copied!' : 'Copy Translation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
