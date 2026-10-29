import React, { useState, useEffect, useRef } from 'react';
import { VisualBlockTranslation } from '../types';
import { Copy, Check, Eye, EyeOff, Download, Sparkles } from 'lucide-react';
import { api } from '../services/api';

interface VisualTranslateViewerProps {
  imagePreview: string;
  blocks: VisualBlockTranslation[];
  targetLanguage?: string;
}

export const VisualTranslateViewer: React.FC<VisualTranslateViewerProps> = ({
  imagePreview,
  blocks,
  targetLanguage = 'Vietnamese',
}) => {
  const [showOriginal, setShowOriginal] = useState<boolean>(false);
  const [hoveredBlockId, setHoveredBlockId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedImage, setCopiedImage] = useState<boolean>(false);
  const [renderedImageUrl, setRenderedImageUrl] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState<number>(1.0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Render in-place translated text over image on Canvas
  useEffect(() => {
    if (!imagePreview || !canvasRef.current) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // 1. Draw original base image
      ctx.drawImage(img, 0, 0);

      // 2. Inpaint and render each block
      for (const block of blocks) {
        const { bbox, translatedText, lineCount } = block;
        if (!bbox || !translatedText) continue;

        const padX = 2;
        const padY = 2;
        const x = Math.max(0, bbox.x0 - padX);
        const y = Math.max(0, bbox.y0 - padY);
        const w = Math.min(canvas.width - x, bbox.x1 - bbox.x0 + padX * 2);
        const h = Math.min(canvas.height - y, bbox.y1 - bbox.y0 + padY * 2);

        if (w <= 3 || h <= 3) continue;

        // Sample background pixels around margins to find dominant background color
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

        // Sample exterior/margin pixels (just outside and inside the bounding box)
        samplePixel(Math.max(0, x - 2), Math.floor(y + h / 2));
        samplePixel(Math.min(canvas.width - 1, x + w + 2), Math.floor(y + h / 2));
        samplePixel(Math.floor(x + w / 2), Math.max(0, y - 2));
        samplePixel(Math.floor(x + w / 2), Math.min(canvas.height - 1, y + h + 2));
        samplePixel(x + 3, y + 2);
        samplePixel(x + w - 3, y + 2);
        samplePixel(x + 3, y + h - 2);
        samplePixel(x + w - 3, y + h - 2);

        // Sort by luminance to pick median color (avoids ink/borders)
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

        // Step 1: Draw filled background to erase original text
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

        // Subtle boundary stroke for clean visual separation
        ctx.strokeStyle = isBgLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Step 2: STRICT CLIPPING PATH
        // Ensures translated text NEVER overflows or bleeds onto neighboring elements/bubbles!
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, w, h, radius);
        } else {
          ctx.rect(x, y, w, h);
        }
        ctx.clip();

        // Step 3: Compute optimal font size and line wrapping
        const availW = Math.max(12, w - 6);
        const availH = Math.max(10, h - 4);
        const words = translatedText.split(/\s+/).filter(Boolean);

        const estLines = lineCount || Math.max(1, Math.round(h / 18));
        const baseTargetSize = Math.floor((h / estLines) * 0.82 * fontScale);
        const startFontSize = Math.min(22, Math.max(9, baseTargetSize));

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

        // If even at size 7 the text has more lines than vertical space, truncate gracefully with ellipsis
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
    img.src = imagePreview;
  }, [imagePreview, blocks, fontScale]);

  const handleCopyTranslatedBlock = (block: VisualBlockTranslation) => {
    api.copyToClipboard(block.translatedText);
    setCopiedId(block.id);
    setTimeout(() => setCopiedId(null), 1800);
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
          // Fallback via data URL
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

  const hoveredBlock = blocks.find((b) => b.id === hoveredBlockId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
      {/* Top Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 8px',
          background: 'rgba(15, 23, 42, 0.75)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: '11px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Sparkles size={13} color="var(--accent-primary)" />
          <span style={{ fontWeight: 600, color: '#f8fafc' }}>
            Visual In-Place Translate ({blocks.length} region{blocks.length > 1 ? 's' : ''})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Font Scale Adjustment */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '4px',
              padding: '1px 3px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              type="button"
              className="btn-icon"
              onClick={() => setFontScale((s) => Math.max(0.7, +(s - 0.1).toFixed(1)))}
              title="Decrease Font Size (Thu nhỏ chữ)"
              style={{ width: '20px', height: '20px', fontSize: '10px', fontWeight: 700 }}
            >
              A-
            </button>
            <span
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                minWidth: '28px',
                textAlign: 'center',
                userSelect: 'none',
              }}
            >
              {Math.round(fontScale * 100)}%
            </span>
            <button
              type="button"
              className="btn-icon"
              onClick={() => setFontScale((s) => Math.min(1.4, +(s + 0.1).toFixed(1)))}
              title="Increase Font Size (Phóng to chữ)"
              style={{ width: '20px', height: '20px', fontSize: '10px', fontWeight: 700 }}
            >
              A+
            </button>
          </div>

          {/* Toggle View Original Button */}
          <button
            type="button"
            className={`btn-icon ${showOriginal ? 'active' : ''}`}
            onClick={() => setShowOriginal(!showOriginal)}
            title={showOriginal ? 'Show Translated Image' : 'Hold / View Original Image'}
            style={{ width: 'auto', padding: '2px 8px', height: '24px', fontSize: '11px', gap: '4px' }}
          >
            {showOriginal ? <EyeOff size={12} /> : <Eye size={12} />}
            <span>{showOriginal ? 'Original' : 'Compare'}</span>
          </button>

          {/* Copy Rendered Image */}
          <button
            type="button"
            className={`btn-icon ${copiedImage ? 'active' : ''}`}
            onClick={handleCopyImage}
            title="Copy Translated Image to Clipboard (Paste anywhere)"
            style={{ width: 'auto', padding: '2px 8px', height: '24px', fontSize: '11px', gap: '4px' }}
          >
            {copiedImage ? <Check size={12} /> : <Copy size={12} />}
            <span>{copiedImage ? 'Copied Image!' : 'Copy Image'}</span>
          </button>

          {/* Download Image */}
          <button
            type="button"
            className="btn-icon"
            onClick={handleDownload}
            title="Download Translated Image as PNG"
            style={{ width: '24px', height: '24px' }}
          >
            <Download size={12} />
          </button>
        </div>
      </div>

      {/* Main Image Display Box with Interactive Hover Highlights */}
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: '160px',
          maxHeight: '260px',
          background: '#05080f',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Hidden offscreen Canvas used for generating the in-place translated image */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Display Image (Either Translated Canvas Output or Original Raw Image) */}
        <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%', display: 'inline-block' }}>
          <img
            src={showOriginal ? imagePreview : renderedImageUrl || imagePreview}
            alt="Translated visual view"
            style={{
              maxWidth: '100%',
              maxHeight: '260px',
              objectFit: 'contain',
              display: 'block',
              borderRadius: '6px',
            }}
          />

          {/* Interactive Clickable / Hoverable Hotspots over blocks */}
          {!showOriginal &&
            canvasRef.current &&
            blocks.map((block) => {
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
                  title={`Click to copy: "${block.translatedText}"\nOriginal: "${block.originalText}"`}
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
                      hoveredBlockId === block.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                    transition: 'all 0.1s ease',
                  }}
                />
              );
            })}
        </div>
      </div>

      {/* Floating Info Tooltip when hovering over a block or clicked */}
      {hoveredBlock && (
        <div
          style={{
            padding: '6px 10px',
            background: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid var(--accent-primary)',
            borderRadius: '6px',
            fontSize: '11.5px',
            lineHeight: '1.4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '10.5px', display: 'block' }}>
              Original: "{hoveredBlock.originalText}"
            </span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>
              → {hoveredBlock.translatedText}
            </span>
          </div>

          <button
            type="button"
            className="btn-icon"
            onClick={() => handleCopyTranslatedBlock(hoveredBlock)}
            title="Copy this translation"
            style={{ width: '22px', height: '22px', flexShrink: 0 }}
          >
            {copiedId === hoveredBlock.id ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
      )}
    </div>
  );
};
