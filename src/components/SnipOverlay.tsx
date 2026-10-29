import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SnipCapturePayload } from '../types';
import { ScanText, X, Globe } from 'lucide-react';

export const OCR_LANGUAGE_OPTIONS = [
  { value: 'auto', label: 'Auto Detect (EN / KR / JP / CN)' },
  { value: 'kor+eng', label: 'Korean + English (한국어)' },
  { value: 'jpn+eng', label: 'Japanese + English (日本語)' },
  { value: 'chi_sim+eng', label: 'Chinese Simplified + EN (简体中文)' },
  { value: 'chi_tra+eng', label: 'Chinese Traditional + EN (繁體中文)' },
  { value: 'eng', label: 'English Only (Tiếng Anh)' },
  { value: 'vie+eng', label: 'Vietnamese + English (Tiếng Việt)' },
];

export const SnipOverlay: React.FC = () => {
  const [captureData, setCaptureData] = useState<SnipCapturePayload | null>(null);
  const [ocrLang, setOcrLang] = useState<string>('auto');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPos, setCurrentPos] = useState<{ x: number; y: number } | null>(null);
  const [isVisible, setIsVisible] = useState<boolean>(false);

  const clearSelectionState = () => {
    setIsDragging(false);
    setStartPos(null);
    setCurrentPos(null);
    setIsVisible(false);
  };

  useEffect(() => {
    const cleanupCapture = api.onSnipScreenCapture((data) => {
      setCaptureData(data);
      if (data.ocrLanguage) {
        setOcrLang(data.ocrLanguage);
      }
      setIsDragging(false);
      setStartPos(null);
      setCurrentPos(null);
      setIsVisible(true);

      // Wait for Chromium to commit the clean frame (with rect === null) to GPU before Main sets window opacity to 1
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          api.notifySnipReady();
        });
      });
    });

    const cleanupReset = api.onSnipReset(() => {
      clearSelectionState();
    });

    return () => {
      cleanupCapture();
      cleanupReset();
    };
  }, []);

  const cancelSnip = () => {
    clearSelectionState();
    requestAnimationFrame(() => {
      api.cancelSnipSelection();
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc' || e.code === 'Escape') {
        e.preventDefault();
        cancelSnip();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  const getSelectionRect = () => {
    if (!startPos || !currentPos) return null;
    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(currentPos.x - startPos.x);
    const height = Math.abs(currentPos.y - startPos.y);
    return { x, y, width, height };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button === 2) {
      cancelSnip();
      return;
    }
    if (e.button !== 0) return;

    setIsDragging(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || e.button !== 0) return;

    const rect = getSelectionRect();
    // Clear selection state IMMEDIATELY so the GPU backbuffer never retains the selection box
    clearSelectionState();

    if (!rect || rect.width < 12 || rect.height < 12) {
      setIsVisible(true);
      return;
    }

    const bounds = captureData?.displayBounds || {
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    requestAnimationFrame(() => {
      api.completeSnipSelection({
        rect,
        viewportWidth,
        viewportHeight,
        ocrLanguage: ocrLang,
        screenX: bounds.x + rect.x + rect.width,
        screenY: bounds.y + rect.y + rect.height,
      });
    });
  };

  const rect = getSelectionRect();

  if (!isVisible) {
    return <div style={{ width: '100vw', height: '100vh', background: 'transparent' }} />;
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => {
        e.preventDefault();
        cancelSnip();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        cursor: 'crosshair',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}
    >
      {/* Smooth dark backdrop when no selection box is dragged yet */}
      {!rect && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 15, 0.42)',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Selection Cutout (Transparent inside, dimmed outside) */}
      {rect && (
        <div
          style={{
            position: 'absolute',
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            backgroundColor: 'transparent',
            border: '2px solid #6366f1',
            boxShadow: '0 0 0 9999px rgba(5, 8, 15, 0.48), 0 0 14px rgba(99, 102, 241, 0.55)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          {/* Size Indicator Tag */}
          <div
            style={{
              position: 'absolute',
              top: rect.y > 32 ? '-28px' : '6px',
              left: '0px',
              background: 'rgba(11, 15, 25, 0.92)',
              color: '#e2e8f0',
              border: '1px solid rgba(99, 102, 241, 0.5)',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '11px',
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            }}
          >
            {Math.round(rect.width)} × {Math.round(rect.height)} px
          </div>
        </div>
      )}

      {/* Top Floating Control Bar (Win+Shift+S style) */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '18px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '8px 16px',
          background: 'rgba(11, 15, 25, 0.92)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(99, 102, 241, 0.45)',
          borderRadius: '999px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.65)',
          cursor: 'default',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc', fontSize: '12px', fontWeight: 600 }}>
          <ScanText size={16} color="#6366f1" />
          <span>Screen OCR Translate</span>
        </div>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)' }} />

        {/* Quick OCR Source Language Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Globe size={13} color="#94a3b8" />
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>OCR Lang:</span>
          <select
            className="form-select"
            value={ocrLang}
            onChange={(e) => setOcrLang(e.target.value)}
            style={{
              width: 'auto',
              padding: '3px 8px',
              fontSize: '11px',
              height: '26px',
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            {OCR_LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.12)' }} />

        <span style={{ fontSize: '11px', color: '#94a3b8' }}>
          Drag mouse to select area • <kbd style={{ background: '#1e293b', padding: '1px 5px', borderRadius: '4px', color: '#e2e8f0' }}>Esc</kbd> to cancel
        </span>

        <button
          className="btn-icon"
          onClick={cancelSnip}
          title="Cancel Snipping (Esc)"
          style={{ width: '24px', height: '24px', borderRadius: '50%' }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};
