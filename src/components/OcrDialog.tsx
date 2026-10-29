import React, { useState, useEffect, useRef } from 'react';
import { VisualBlockTranslation, VisualTranslationPayload, OcrStatePayload } from '../types';
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  Download,
  Sparkles,
  Pin,
  PinOff,
  X,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  FileText,
  Image as ImageIcon,
  Loader2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { api } from '../services/api';

export const OcrDialog: React.FC = () => {
  const [ocrState, setOcrState] = useState<OcrStatePayload>({
    status: 'processing',
    message: 'Đang nhận diện chữ trong ảnh (OCR)...',
  });
  const [visualData, setVisualData] = useState<VisualTranslationPayload | null>(null);
  const [viewMode, setViewMode] = useState<'visual' | 'text'>('visual');
  const [scaleMode, setScaleMode] = useState<'original' | 'fit'>('original');
  const [zoom, setZoom] = useState<number>(100);
  const [fontScale, setFontScale] = useState<number>(1.0);
  const [showOriginal, setShowOriginal] = useState<boolean>(false);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [hoveredBlockId, setHoveredBlockId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [renderedImageUrl, setRenderedImageUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Listen to IPC events for OCR status and Visual Translate payload
  useEffect(() => {
    const cleanupState = api.onOcrStateChange((state) => {
      setOcrState(state);
      if (state.status === 'processing') {
        setShowOriginal(false);
      }
    });

    const cleanupVisual = api.onTriggerVisualTranslate((data) => {
      setOcrState({ status: 'done', imagePreview: data.imagePreview });
      setVisualData(data);
      setViewMode('visual');
    });

    return () => {
      cleanupState();
      cleanupVisual();
    };
  }, []);

  // Handle window click outside to close if not pinned
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

  // Inpaint and render translated text onto Canvas
  useEffect(() => {
    const imageSource = visualData?.imagePreview || ocrState.imagePreview;
    if (!imageSource || !visualData?.blocks || visualData.blocks.length === 0) {
      setRenderedImageUrl(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // 1. Draw original base image
      ctx.drawImage(img, 0, 0);

      // 2. Inpaint and render each block
      for (const block of visualData.blocks) {
        const { bbox, translatedText, lineCount } = block;
        if (!bbox || !translatedText) continue;

        const padX = 2;
        const padY = 2;
        const x = Math.max(0, bbox.x0 - padX);
        const y = Math.max(0, bbox.y0 - padY);
        const w = Math.min(canvas.width - x, bbox.x1 - bbox.x0 + padX * 2);
        const h = Math.min(canvas.height - y, bbox.y1 - bbox.y0 + padY * 2);

        if (w <= 3 || h <= 3) continue;

        // Sample background pixels to calculate median background color
        const sampledColors: { r: number; g: number; b: number; lum: number }[] = [];
        const samplePixel = (sx: number, sy: number) => {
          if (sx >= 0 && sx < canvas.width && sy >= 0 && sy < canvas.height) {
            try {
              const d = ctx.getImageData(sx, sy, 1, 1).data;
              const lum = 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2];
              sampledColors.push({ r: d[0], g: d[1], b: d[2], lum });
            } catch (e) {}
          }
        };

        samplePixel(Math.max(0, x - 2), Math.floor(y + h / 2));
        samplePixel(Math.min(canvas.width - 1, x + w + 2), Math.floor(y + h / 2));
        samplePixel(Math.floor(x + w / 2), Math.max(0, y - 2));
        samplePixel(Math.floor(x + w / 2), Math.min(canvas.height - 1, y + h + 2));
        samplePixel(x + 3, y + 2);
        samplePixel(x + w - 3, y + 2);
        samplePixel(x + 3, y + h - 2);
        samplePixel(x + w - 3, y + h - 2);

        let avgR = 255, avgG = 255, avgB = 255;
        if (sampledColors.length > 0) {
          sampledColors.sort((a, b) => a.lum - b.lum);
          const median = sampledColors[Math.floor(sampledColors.length / 2)];
          avgR = median.r;
          avgG = median.g;
          avgB = median.b;
        }

        const luminance = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;
        const isBgLight = luminance > 130;
        const textColor = isBgLight ? '#0f172a' : '#f8fafc';
        const bgColor = `rgb(${avgR}, ${avgG}, ${avgB})`;

        // Step 1: Draw filled background
        ctx.save();
        ctx.fillStyle = bgColor;
        const radius = Math.min(6, Math.floor(h / 4));
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, w, h, radius);
        } else {
          ctx.rect(x, y, w, h);
        }
        ctx.fill();

        ctx.strokeStyle = isBgLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Step 2: Strict Clipping to prevent any spilling
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, w, h, radius);
        } else {
          ctx.rect(x, y, w, h);
        }
        ctx.clip();

        // Step 3: Compute optimal font size
        const availW = Math.max(12, w - 6);
        const availH = Math.max(10, h - 4);
        const words = translatedText.split(/\s+/).filter(Boolean);

        const estLines = lineCount || Math.max(1, Math.round(h / 18));
        const baseTargetSize = Math.floor((h / estLines) * 0.82 * fontScale);
        const startFontSize = Math.min(24, Math.max(9, baseTargetSize));

        let bestFontSize = 8;
        let bestLines: string[] = [];

        for (let size = startFontSize; size >= 7; size--) {
          ctx.font = `600 ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
          const lh = Math.round(size * 1.25);
          const maxAllowedLines = Math.max(1, Math.floor(availH / lh));

          const lines: string[] = [];
          let cur = '';

          for (const word of words) {
            const test = cur ? `${cur} ${word}` : word;
            if (ctx.measureText(test).width > availW && cur) {
              lines.push(cur);
              cur = word;
            } else {
              cur = test;
            }
          }
          if (cur) lines.push(cur);

          if (lines.length <= maxAllowedLines) {
            bestFontSize = size;
            bestLines = lines;
            break;
          }
        }

        if (bestLines.length === 0) {
          bestFontSize = 7;
          ctx.font = `600 ${bestFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          const lines: string[] = [];
          let cur = '';
          for (const word of words) {
            const test = cur ? `${cur} ${word}` : word;
            if (ctx.measureText(test).width > availW && cur) {
              lines.push(cur);
              cur = word;
            } else {
              cur = test;
            }
          }
          if (cur) lines.push(cur);
          bestLines = lines;
        }

        const lineHeight = Math.round(bestFontSize * 1.25);
        const maxLines = Math.max(1, Math.floor(availH / lineHeight));
        if (bestLines.length > maxLines) {
          bestLines = bestLines.slice(0, maxLines);
          let last = bestLines[maxLines - 1];
          while (last.length > 0 && ctx.measureText(last + '…').width > availW) {
            last = last.slice(0, -1).trim();
          }
          bestLines[maxLines - 1] = (last || '') + '…';
        }

        // Step 4: Render text within vertical bounds
        ctx.fillStyle = textColor;
        ctx.font = `600 ${bestFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        const totalTextHeight = bestLines.length * lineHeight;
        const startY = y + Math.max(2, Math.floor((h - totalTextHeight) / 2));
        const startX = x + Math.max(3, Math.min(6, Math.floor(w * 0.03)));

        for (let i = 0; i < bestLines.length; i++) {
          ctx.fillText(bestLines[i], startX, startY + i * lineHeight);
        }

        ctx.restore();
      }

      setRenderedImageUrl(canvas.toDataURL('image/png'));
    };
    img.src = imageSource;
  }, [visualData, ocrState.imagePreview, fontScale]);

  const handleTogglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    api.setOcrPinned(next);
  };

  const handleCopyTranslatedBlock = (block: VisualBlockTranslation) => {
    api.copyToClipboard(block.translatedText);
    setCopiedId(block.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleCopyAllText = () => {
    if (!visualData?.fullTranslatedText) return;
    api.copyToClipboard(visualData.fullTranslatedText);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleCopyImage = async () => {
    if (!canvasRef.current) return;
    try {
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ]);
          setCopiedImage(true);
          setTimeout(() => setCopiedImage(false), 2000);
        } catch (err) {
          const dataUrl = canvasRef.current?.toDataURL('image/png');
          if (dataUrl) {
            api.copyToClipboard(dataUrl);
            setCopiedImage(true);
            setTimeout(() => setCopiedImage(false), 2000);
          }
        }
      });
    } catch (e) {
      console.error('Failed to copy image to clipboard:', e);
    }
  };

  const handleDownload = () => {
    if (!renderedImageUrl) return;
    const a = document.createElement('a');
    a.href = renderedImageUrl;
    a.download = `translated_image_${Date.now()}.png`;
    a.click();
  };

  const hoveredBlock = visualData?.blocks.find((b) => b.id === hoveredBlockId);
  const currentImagePreview = visualData?.imagePreview || ocrState.imagePreview;

  return (
    <div
      className="glass-panel"
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '12px',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7), 0 0 30px rgba(99, 102, 241, 0.15)',
        background: 'rgba(11, 15, 25, 0.94)',
        backdropFilter: 'blur(20px)',
        overflow: 'hidden',
      }}
    >
      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Header Bar */}
      <div
        className="drag-region"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(18, 24, 38, 0.85)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '12px',
          minHeight: '42px',
        }}
      >
        {/* Left: Title & Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
            }}
          >
            <Sparkles size={14} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.2px' }}>
            Visual OCR Translator
          </span>
          {visualData?.blocks && (
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '10px',
                background: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
                fontWeight: 600,
                border: '1px solid rgba(99, 102, 241, 0.3)',
              }}
            >
              {visualData.blocks.length} khối chữ
            </span>
          )}
          {visualData?.targetLanguage && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              → {visualData.targetLanguage}
            </span>
          )}
        </div>

        {/* Right: Controls & Actions */}
        <div className="no-drag" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Mode switch (Visual vs Text) */}
          {visualData && (
            <div
              style={{
                display: 'flex',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '6px',
                padding: '2px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                type="button"
                className={`btn-icon ${viewMode === 'visual' ? 'active' : ''}`}
                onClick={() => setViewMode('visual')}
                title="Xem ảnh đè bản dịch trực quan"
                style={{
                  width: 'auto',
                  padding: '2px 8px',
                  height: '22px',
                  fontSize: '11px',
                  gap: '4px',
                  background: viewMode === 'visual' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'visual' ? '#fff' : 'var(--text-muted)',
                }}
              >
                <ImageIcon size={11} />
                <span>Visual</span>
              </button>
              <button
                type="button"
                className={`btn-icon ${viewMode === 'text' ? 'active' : ''}`}
                onClick={() => setViewMode('text')}
                title="Xem dạng văn bản thuần"
                style={{
                  width: 'auto',
                  padding: '2px 8px',
                  height: '22px',
                  fontSize: '11px',
                  gap: '4px',
                  background: viewMode === 'text' ? 'var(--accent-primary)' : 'transparent',
                  color: viewMode === 'text' ? '#fff' : 'var(--text-muted)',
                }}
              >
                <FileText size={11} />
                <span>Text</span>
              </button>
            </div>
          )}

          {/* Scale mode: 1:1 Original vs Fit */}
          {visualData && viewMode === 'visual' && (
            <div
              style={{
                display: 'flex',
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '6px',
                padding: '2px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                type="button"
                className={`btn-icon ${scaleMode === 'original' ? 'active' : ''}`}
                onClick={() => {
                  setScaleMode('original');
                  setZoom(100);
                }}
                title="Hiển thị theo kích thước gốc 100% (1:1 Native Resolution)"
                style={{
                  width: 'auto',
                  padding: '2px 7px',
                  height: '22px',
                  fontSize: '11px',
                  gap: '4px',
                  background: scaleMode === 'original' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                  color: scaleMode === 'original' ? '#38bdf8' : 'var(--text-muted)',
                }}
              >
                <Maximize2 size={11} />
                <span>1:1 Gốc</span>
              </button>
              <button
                type="button"
                className={`btn-icon ${scaleMode === 'fit' ? 'active' : ''}`}
                onClick={() => {
                  setScaleMode('fit');
                  setZoom(100);
                }}
                title="Tự co vừa khung nhìn cửa sổ"
                style={{
                  width: 'auto',
                  padding: '2px 7px',
                  height: '22px',
                  fontSize: '11px',
                  gap: '4px',
                  background: scaleMode === 'fit' ? 'rgba(99, 102, 241, 0.3)' : 'transparent',
                  color: scaleMode === 'fit' ? '#38bdf8' : 'var(--text-muted)',
                }}
              >
                <Minimize2 size={11} />
                <span>Vừa khung</span>
              </button>
            </div>
          )}

          {/* Zoom controls (Only in 1:1 original mode) */}
          {visualData && viewMode === 'visual' && scaleMode === 'original' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '5px',
                padding: '1px 3px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                type="button"
                className="btn-icon"
                onClick={() => setZoom((z) => Math.max(50, z - 15))}
                title="Thu nhỏ ảnh"
                style={{ width: '20px', height: '20px' }}
              >
                <ZoomOut size={11} />
              </button>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', minWidth: '32px', textAlign: 'center' }}>
                {zoom}%
              </span>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setZoom((z) => Math.min(250, z + 15))}
                title="Phóng to ảnh"
                style={{ width: '20px', height: '20px' }}
              >
                <ZoomIn size={11} />
              </button>
            </div>
          )}

          {/* Font Scale Adjustment */}
          {visualData && viewMode === 'visual' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '5px',
                padding: '1px 3px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <button
                type="button"
                className="btn-icon"
                onClick={() => setFontScale((s) => Math.max(0.6, +(s - 0.1).toFixed(1)))}
                title="Thu nhỏ cỡ chữ đè"
                style={{ width: '20px', height: '20px', fontSize: '10px', fontWeight: 700 }}
              >
                A-
              </button>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', minWidth: '28px', textAlign: 'center' }}>
                {Math.round(fontScale * 100)}%
              </span>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setFontScale((s) => Math.min(1.5, +(s + 0.1).toFixed(1)))}
                title="Phóng to cỡ chữ đè"
                style={{ width: '20px', height: '20px', fontSize: '10px', fontWeight: 700 }}
              >
                A+
              </button>
            </div>
          )}

          {/* Toggle View Original Button */}
          {visualData && viewMode === 'visual' && (
            <button
              type="button"
              className={`btn-icon ${showOriginal ? 'active' : ''}`}
              onClick={() => setShowOriginal(!showOriginal)}
              title={showOriginal ? 'Hiển thị bản dịch' : 'Giữ/Xem ảnh gốc ban đầu'}
              style={{ width: 'auto', padding: '2px 8px', height: '22px', fontSize: '11px', gap: '4px' }}
            >
              {showOriginal ? <EyeOff size={11} /> : <Eye size={11} />}
              <span>{showOriginal ? 'Ảnh Gốc' : 'So sánh'}</span>
            </button>
          )}

          {/* Copy Image Button */}
          {visualData && viewMode === 'visual' && (
            <button
              type="button"
              className={`btn-icon ${copiedImage ? 'active' : ''}`}
              onClick={handleCopyImage}
              title="Sao chép ảnh đã dịch vào clipboard (Dán vào Zalo/Messenger/Word)"
              style={{ width: 'auto', padding: '2px 8px', height: '22px', fontSize: '11px', gap: '4px' }}
            >
              {copiedImage ? <Check size={11} /> : <Copy size={11} />}
              <span>{copiedImage ? 'Đã sao chép!' : 'Copy Ảnh'}</span>
            </button>
          )}

          {/* Download Image Button */}
          {visualData && viewMode === 'visual' && (
            <button
              type="button"
              className="btn-icon"
              onClick={handleDownload}
              title="Tải ảnh đã dịch về máy (PNG)"
              style={{ width: '24px', height: '22px' }}
            >
              <Download size={11} />
            </button>
          )}

          {/* Copy Full Text Button (Text mode) */}
          {visualData && viewMode === 'text' && (
            <button
              type="button"
              className={`btn-icon ${copiedText ? 'active' : ''}`}
              onClick={handleCopyAllText}
              title="Sao chép toàn bộ văn bản dịch"
              style={{ width: 'auto', padding: '2px 8px', height: '22px', fontSize: '11px', gap: '4px' }}
            >
              {copiedText ? <Check size={11} /> : <Copy size={11} />}
              <span>{copiedText ? 'Đã sao chép!' : 'Copy Text'}</span>
            </button>
          )}

          {/* Pin Button */}
          <button
            type="button"
            className={`btn-icon ${isPinned ? 'active' : ''}`}
            onClick={handleTogglePin}
            title={isPinned ? 'Bỏ ghim cửa sổ' : 'Ghim cửa sổ trên cùng (Không tự đóng khi click ra ngoài)'}
            style={{ width: '24px', height: '22px' }}
          >
            {isPinned ? <PinOff size={11} /> : <Pin size={11} />}
          </button>

          {/* Close Button */}
          <button
            type="button"
            className="btn-icon"
            onClick={() => api.closeOcrDialog()}
            title="Đóng (Esc)"
            style={{ width: '24px', height: '22px', color: 'var(--text-muted)' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Loading / Processing State */}
        {ocrState.status === 'processing' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
              padding: '24px',
            }}
          >
            <div style={{ position: 'relative' }}>
              <Loader2 size={36} color="var(--accent-primary)" className="animate-spin" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc', display: 'block' }}>
                {ocrState.message || 'Đang xử lý nhận diện và dịch hình ảnh...'}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                Đang sử dụng LM Studio (Gemma 4) để dịch từng vùng văn bản
              </span>
            </div>

            {ocrState.imagePreview && (
              <div
                style={{
                  marginTop: '12px',
                  maxHeight: '180px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  opacity: 0.6,
                }}
              >
                <img
                  src={ocrState.imagePreview}
                  alt="Processing thumbnail"
                  style={{ maxHeight: '180px', objectFit: 'contain', display: 'block' }}
                />
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {ocrState.status === 'error' && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: '30px',
            }}
          >
            <AlertTriangle size={36} color="var(--danger)" />
            <span style={{ fontSize: '13px', color: '#f87171', textAlign: 'center', maxWidth: '420px', lineHeight: 1.5 }}>
              {ocrState.message || 'Không tìm thấy ký tự hoặc xảy ra lỗi khi trích xuất hình ảnh.'}
            </span>
            <button
              type="button"
              className="btn-primary"
              onClick={() => api.closeOcrDialog()}
              style={{ marginTop: '10px', padding: '6px 16px', fontSize: '12px' }}
            >
              Đóng cửa sổ
            </button>
          </div>
        )}

        {/* Visual View Mode (1:1 Original Native Scale) */}
        {ocrState.status === 'done' && viewMode === 'visual' && currentImagePreview && (
          <div
            style={{
              flex: 1,
              position: 'relative',
              overflow: 'auto',
              background: '#040711',
              display: 'flex',
              alignItems: scaleMode === 'fit' ? 'center' : 'flex-start',
              justifyContent: scaleMode === 'fit' ? 'center' : 'flex-start',
              padding: scaleMode === 'original' ? '12px' : '6px',
            }}
          >
            <div
              style={{
                position: 'relative',
                display: 'inline-block',
                maxWidth: scaleMode === 'fit' ? '100%' : 'none',
                maxHeight: scaleMode === 'fit' ? '100%' : 'none',
              }}
            >
              <img
                ref={imgRef}
                src={showOriginal ? currentImagePreview : renderedImageUrl || currentImagePreview}
                alt="Translated Visual Preview"
                style={{
                  display: 'block',
                  borderRadius: '6px',
                  boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  width:
                    scaleMode === 'original' && naturalSize.width > 0
                      ? `${Math.round(naturalSize.width * (zoom / 100))}px`
                      : scaleMode === 'fit'
                      ? '100%'
                      : 'auto',
                  height:
                    scaleMode === 'original' && naturalSize.height > 0
                      ? `${Math.round(naturalSize.height * (zoom / 100))}px`
                      : scaleMode === 'fit'
                      ? '100%'
                      : 'auto',
                  maxWidth: scaleMode === 'fit' ? '100%' : 'none',
                  maxHeight: scaleMode === 'fit' ? 'calc(100vh - 120px)' : 'none',
                  objectFit: scaleMode === 'fit' ? 'contain' : 'initial',
                }}
              />

              {/* Interactive Hotspots over translated blocks */}
              {!showOriginal &&
                visualData?.blocks &&
                canvasRef.current &&
                visualData.blocks.map((block) => {
                  const canvasW = canvasRef.current?.width || 1;
                  const canvasH = canvasRef.current?.height || 1;

                  const leftPct = (block.bbox.x0 / canvasW) * 100;
                  const topPct = (block.bbox.y0 / canvasH) * 100;
                  const widthPct = ((block.bbox.x1 - block.bbox.x0) / canvasW) * 100;
                  const heightPct = ((block.bbox.y1 - block.bbox.y0) / canvasH) * 100;

                  return (
                    <div
                      key={block.id}
                      onMouseEnter={() => setHoveredBlockId(block.id)}
                      onMouseLeave={() => setHoveredBlockId(null)}
                      onClick={() => handleCopyTranslatedBlock(block)}
                      title={`Nhấp để copy bản dịch:\n"${block.translatedText}"`}
                      style={{
                        position: 'absolute',
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                        cursor: 'pointer',
                        borderRadius: '3px',
                        border:
                          hoveredBlockId === block.id
                            ? '1.5px solid var(--accent-primary)'
                            : '1px solid transparent',
                        backgroundColor:
                          hoveredBlockId === block.id ? 'rgba(99, 102, 241, 0.18)' : 'transparent',
                        transition: 'all 0.1s ease',
                      }}
                    />
                  );
                })}
            </div>
          </div>
        )}

        {/* Text View Mode (Side-by-side or stacked clean text) */}
        {ocrState.status === 'done' && viewMode === 'text' && visualData && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'row',
              gap: '12px',
              padding: '12px',
              overflow: 'hidden',
            }}
          >
            {/* Original Text */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(0, 0, 0, 0.25)',
                borderRadius: '8px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                padding: '10px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  paddingBottom: '6px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                  VĂN BẢN GỐC (OCR)
                </span>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => api.copyToClipboard(visualData.fullOriginalText)}
                  title="Sao chép văn bản gốc"
                  style={{ width: '20px', height: '20px' }}
                >
                  <Copy size={11} />
                </button>
              </div>
              <div
                className="select-text"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  fontSize: '12.5px',
                  lineHeight: '1.6',
                  color: 'var(--text-main)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {visualData.fullOriginalText}
              </div>
            </div>

            {/* Translated Text */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(15, 23, 42, 0.4)',
                borderRadius: '8px',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                padding: '10px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  paddingBottom: '6px',
                  borderBottom: '1px solid rgba(99, 102, 241, 0.15)',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#818cf8' }}>
                  BẢN DỊCH ({visualData.targetLanguage})
                </span>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={handleCopyAllText}
                  title="Sao chép bản dịch"
                  style={{ width: '20px', height: '20px' }}
                >
                  {copiedText ? <Check size={11} /> : <Copy size={11} />}
                </button>
              </div>
              <div
                className="select-text"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  fontSize: '13px',
                  lineHeight: '1.65',
                  color: '#f8fafc',
                  whiteSpace: 'pre-wrap',
                  fontWeight: 500,
                }}
              >
                {visualData.fullTranslatedText}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Floating Info Tooltip when hovering over a block */}
      {hoveredBlock && (
        <div
          style={{
            padding: '8px 14px',
            background: 'rgba(15, 23, 42, 0.96)',
            borderTop: '1px solid var(--accent-primary)',
            fontSize: '12px',
            lineHeight: '1.45',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'block', marginBottom: '2px' }}>
              Gốc: "{hoveredBlock.originalText}"
            </span>
            <span style={{ color: '#38bdf8', fontWeight: 600, fontSize: '12.5px' }}>
              → {hoveredBlock.translatedText}
            </span>
          </div>

          <button
            type="button"
            className="btn-icon"
            onClick={() => handleCopyTranslatedBlock(hoveredBlock)}
            title="Sao chép câu dịch này"
            style={{ width: '24px', height: '24px', flexShrink: 0 }}
          >
            {copiedId === hoveredBlock.id ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      )}
    </div>
  );
};
