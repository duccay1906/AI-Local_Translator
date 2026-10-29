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
        const { bbox, translatedText } = block;
        if (!bbox || !translatedText) continue;

        const padX = 3;
        const padY = 2;
        const x = Math.max(0, bbox.x0 - padX);
        const y = Math.max(0, bbox.y0 - padY);
        const w = Math.min(canvas.width - x, bbox.x1 - bbox.x0 + padX * 2);
        const h = Math.min(canvas.height - y, bbox.y1 - bbox.y0 + padY * 2);

        if (w <= 2 || h <= 2) continue;

        // Sample background color around the perimeter of the bounding box
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        try {
          const samplePerimeter = (sampleX: number, sampleY: number) => {
            if (sampleX >= 0 && sampleX < canvas.width && sampleY >= 0 && sampleY < canvas.height) {
              const pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
              rSum += pixel[0];
              gSum += pixel[1];
              bSum += pixel[2];
              count++;
            }
          };

          // Sample 8 points around borders
          samplePerimeter(x, y);
          samplePerimeter(x + Math.floor(w / 2), y);
          samplePerimeter(x + w, y);
          samplePerimeter(x, y + h);
          samplePerimeter(x + Math.floor(w / 2), y + h);
          samplePerimeter(x + w, y + h);
          samplePerimeter(x, y + Math.floor(h / 2));
          samplePerimeter(x + w, y + Math.floor(h / 2));
        } catch (e) {}

        const avgR = count > 0 ? Math.round(rSum / count) : 255;
        const avgG = count > 0 ? Math.round(gSum / count) : 255;
        const avgB = count > 0 ? Math.round(bSum / count) : 255;

        // Determine text color based on background luminance
        const luminance = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;
        const isBgLight = luminance > 130;
        const textColor = isBgLight ? '#0f172a' : '#f8fafc';
        const bgColor = `rgb(${avgR}, ${avgG}, ${avgB})`;

        // Draw filled rounded rectangle to erase original text
        ctx.save();
        ctx.fillStyle = bgColor;
        const radius = Math.min(5, Math.floor(h / 4));
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, w, h, radius);
        } else {
          ctx.rect(x, y, w, h);
        }
        ctx.fill();

        // Optional subtle outline for clarity
        ctx.strokeStyle = isBgLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Calculate auto-fit font size
        const words = translatedText.split(/\s+/).filter(Boolean);
        let bestFontSize = Math.min(18, Math.max(10, Math.floor(h * 0.42)));
        let bestLines: string[] = [];

        for (let size = bestFontSize; size >= 9; size--) {
          ctx.font = `600 ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
          const lines: string[] = [];
          let currentLine = '';

          for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > w - 6 && currentLine) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          }
          if (currentLine) lines.push(currentLine);

          const totalHeight = lines.length * (size * 1.25);
          if (totalHeight <= h - 2 || size === 9) {
            bestFontSize = size;
            bestLines = lines;
            break;
          }
        }

        // Render text
        ctx.fillStyle = textColor;
        ctx.font = `600 ${bestFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const lineHeight = bestFontSize * 1.25;
        const startY = y + h / 2 - ((bestLines.length - 1) * lineHeight) / 2;

        for (let i = 0; i < bestLines.length; i++) {
          ctx.fillText(bestLines[i], x + w / 2, startY + i * lineHeight);
        }

        ctx.restore();
      }

      setRenderedImageUrl(canvas.toDataURL('image/png'));
    };
    img.src = imagePreview;
  }, [imagePreview, blocks]);

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
