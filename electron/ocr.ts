import { createWorker, Worker } from 'tesseract.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { OcrTextBlock } from '../src/types';

// Cached workers by language key (e.g. 'kor+eng', 'jpn+eng', 'chi_sim+eng')
const workerPool: Map<string, Worker> = new Map();
const initLocks: Map<string, Promise<Worker>> = new Map();

const AUTO_CANDIDATE_LANGS = ['kor+eng', 'jpn+eng', 'chi_sim+eng'];

let cacheSeeded = false;

function getOcrCacheDir(): string {
  const dir = path.join(app.getPath('userData'), 'ocr-cache');
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!cacheSeeded) {
      cacheSeeded = true;
      const bundledCandidates = [
        path.join(__dirname, '../build/ocr-cache'),
        path.join(app.getAppPath(), 'build/ocr-cache'),
        path.join(process.resourcesPath || '', 'app/build/ocr-cache'),
        path.join(process.cwd(), 'build/ocr-cache'),
      ];

      for (const bundledDir of bundledCandidates) {
        if (fs.existsSync(bundledDir)) {
          const files = fs.readdirSync(bundledDir).filter((f) => f.endsWith('.traineddata'));
          for (const file of files) {
            const destPath = path.join(dir, file);
            if (!fs.existsSync(destPath)) {
              fs.copyFileSync(path.join(bundledDir, file), destPath);
            }
          }
          break;
        }
      }
    }
  } catch (err) {
    console.error('Failed to initialize OCR cache dir:', err);
  }
  return dir;
}

/**
 * Normalizes a requested language code so that CJK/Vietnamese scripts ALWAYS precede 'eng'
 * (putting 'eng' first in Tesseract LSTM causes non-Latin characters to be misread as ASCII).
 */
function normalizeLangCode(langCode: string): string {
  if (!langCode || langCode === 'auto' || langCode === 'eng+jpn+kor+chi_sim') {
    return 'auto';
  }
  const map: Record<string, string> = {
    kor: 'kor+eng',
    jpn: 'jpn+eng',
    chi_sim: 'chi_sim+eng',
    chi_tra: 'chi_tra+eng',
    vie: 'vie+eng',
    'eng+vie': 'vie+eng',
    eng: 'eng',
  };
  return map[langCode] || langCode;
}

/**
 * Normalizes OCR text output:
 * - Removes extra spaces between Chinese/Japanese characters (Hanzi/Kanji/Hiragana/Katakana)
 * - Preserves natural word spacing for Korean (Hangul), English, and Vietnamese
 */
export function cleanOcrText(rawText: string): string {
  if (!rawText) return '';

  let cleaned = rawText
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();

  // Remove extra spaces ONLY between Japanese Kana and CJK Hanzi/Kanji (NOT Korean Hangul \uac00-\ud7a3 which uses word spaces!)
  const jpCnRegex = /([\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f])\s+([\u3000-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f])/g;
  cleaned = cleaned.replace(jpCnRegex, '$1$2').replace(jpCnRegex, '$1$2');

  // Collapse 3+ newlines into double newline
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.join('\n').trim();
}

async function getOrCreateWorker(
  langKey: string,
  onProgress?: (statusText: string) => void
): Promise<Worker> {
  const existing = workerPool.get(langKey);
  if (existing) {
    return existing;
  }

  const pending = initLocks.get(langKey);
  if (pending) {
    return pending;
  }

  const cacheDir = getOcrCacheDir();
  const createPromise = (async () => {
    try {
      const worker = await createWorker(langKey, 1, {
        cachePath: cacheDir,
        logger: (m) => {
          if (m.status && m.status.startsWith('loading language traineddata')) {
            const pct = Math.round((m.progress || 0) * 100);
            onProgress?.(`Loading OCR model (${langKey}: ${pct}%)...`);
          } else if (m.status === 'recognizing text') {
            const pct = Math.round((m.progress || 0) * 100);
            onProgress?.(`Extracting text (${pct}%)...`);
          }
        },
      });
      workerPool.set(langKey, worker);
      return worker;
    } finally {
      initLocks.delete(langKey);
    }
  })();

  initLocks.set(langKey, createPromise);
  return createPromise;
}

export interface ScoredOcrResult {
  langKey: string;
  text: string;
  blocks: OcrTextBlock[];
  score: number;
}

/**
 * Clusters individual OCR lines into visually coherent text blocks (e.g. chat bubbles, paragraphs)
 * by analyzing vertical gap and horizontal alignment.
 */
function clusterLinesIntoBlocks(rawLines: any[], threshold: number): OcrTextBlock[] {
  if (!rawLines || rawLines.length === 0) return [];

  const validLines = rawLines.filter(
    (l) => (l.confidence || 0) >= threshold && l.text && l.text.trim().length > 0
  );
  if (validLines.length === 0) return [];

  // Sort lines primarily by vertical position y0, secondarily by x0
  validLines.sort((a, b) => {
    const diffY = a.bbox.y0 - b.bbox.y0;
    if (Math.abs(diffY) > 5) return diffY;
    return a.bbox.x0 - b.bbox.x0;
  });

  const groups: (typeof validLines)[] = [];
  let currentGroup = [validLines[0]];

  for (let i = 1; i < validLines.length; i++) {
    const curr = validLines[i];
    const prev = currentGroup[currentGroup.length - 1];

    const prevH = Math.max(8, prev.bbox.y1 - prev.bbox.y0);
    const currH = Math.max(8, curr.bbox.y1 - curr.bbox.y0);
    const avgH = (prevH + currH) / 2;

    const gapY = curr.bbox.y0 - prev.bbox.y1;
    const overlapX = Math.min(prev.bbox.x1, curr.bbox.x1) - Math.max(prev.bbox.x0, curr.bbox.x0);
    const leftDiff = Math.abs(prev.bbox.x0 - curr.bbox.x0);
    const rightDiff = Math.abs(prev.bbox.x1 - curr.bbox.x1);

    // Belong to the same block if:
    // 1. Vertical gap is within line spacing threshold (<= 1.35 * avg line height, or <= 16px)
    // 2. Horizontally aligned (overlap > 0, or left/right margin within 35px)
    const isVerticalClose = gapY <= Math.max(14, avgH * 1.35) && gapY >= -avgH * 0.6;
    const isHorizontalAligned = overlapX > 0 || leftDiff < 35 || rightDiff < 35;

    if (isVerticalClose && isHorizontalAligned) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  const blocks: OcrTextBlock[] = [];
  let idCounter = 1;

  for (const group of groups) {
    const text = cleanOcrText(group.map((l) => l.text.trim()).join(' '));
    // Filter out solitary noise / symbols
    if (!text || (text.length <= 1 && !/[a-zA-Z0-9\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7a3]/.test(text))) {
      continue;
    }

    const x0 = Math.min(...group.map((l) => l.bbox.x0));
    const y0 = Math.min(...group.map((l) => l.bbox.y0));
    const x1 = Math.max(...group.map((l) => l.bbox.x1));
    const y1 = Math.max(...group.map((l) => l.bbox.y1));
    const avgConf = group.reduce((sum, l) => sum + (l.confidence || 0), 0) / group.length;

    blocks.push({
      id: idCounter++,
      bbox: { x0, y0, x1, y1 },
      text,
      confidence: avgConf,
      lineCount: group.length,
    });
  }

  return blocks;
}

async function recognizeWithWorker(
  langKey: string,
  imageBuffer: Buffer,
  onProgress?: (statusText: string) => void
): Promise<ScoredOcrResult> {
  try {
    const worker = await getOrCreateWorker(langKey, onProgress);
    const result = await worker.recognize(imageBuffer);
    const lines = result?.data?.lines || [];

    // Filter noise threshold
    const maxLineConf = lines.length > 0 ? Math.max(...lines.map((l) => l.confidence || 0)) : 0;
    const threshold = maxLineConf >= 65 ? 45 : 0;

    // Cluster lines into cohesive blocks
    let blocks = clusterLinesIntoBlocks(lines, threshold);

    // Fallback if clustering produced nothing
    if (blocks.length === 0 && lines.length > 0) {
      const validLines = lines.filter(
        (l) => (l.confidence || 0) >= threshold && l.text && l.text.trim().length > 0
      );
      let fallbackId = 1;
      for (const l of validLines) {
        const text = cleanOcrText(l.text);
        if (text) {
          blocks.push({
            id: fallbackId++,
            bbox: l.bbox,
            text,
            confidence: l.confidence,
            lineCount: 1,
          });
        }
      }
    }

    const fullText = blocks.map((b) => b.text).join('\n\n');
    const score =
      blocks.length > 0
        ? blocks.reduce((sum, b) => sum + b.confidence, 0) / blocks.length
        : result?.data?.confidence || 0;

    return {
      langKey,
      text: fullText,
      blocks,
      score: fullText ? score : 0,
    };
  } catch (err: any) {
    // Evict broken worker from pool
    const broken = workerPool.get(langKey);
    if (broken) {
      workerPool.delete(langKey);
      try {
        await broken.terminate();
      } catch (e) {}
    }
    throw err;
  }
}

export interface OcrExtractionResult {
  fullText: string;
  blocks: OcrTextBlock[];
  detectedLang: string;
}

export async function extractTextAndBlocksFromImage(
  imageDataUrl: string,
  langCode: string = 'auto',
  onProgress?: (statusText: string) => void
): Promise<OcrExtractionResult> {
  const normalizedLang = normalizeLangCode(langCode);
  const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Data, 'base64');

  if (normalizedLang === 'auto') {
    onProgress?.('Auto-detecting language & text blocks (KR/JP/CN/EN)...');
    const candidates = await Promise.all(
      AUTO_CANDIDATE_LANGS.map((key) =>
        recognizeWithWorker(key, imageBuffer, onProgress).catch(() => ({
          langKey: key,
          text: '',
          blocks: [],
          score: -1,
        }))
      )
    );

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    console.log(
      'Auto OCR scores:',
      candidates.map((c) => `${c.langKey}:${Math.round(c.score)} (blocks: ${c.blocks.length})`).join(', '),
      '-> Winner:',
      best?.langKey
    );
    return {
      fullText: best?.text || '',
      blocks: best?.blocks || [],
      detectedLang: best?.langKey || 'auto',
    };
  }

  onProgress?.(`Extracting text & bounding boxes (${normalizedLang})...`);
  const res = await recognizeWithWorker(normalizedLang, imageBuffer, onProgress);
  return {
    fullText: res.text,
    blocks: res.blocks,
    detectedLang: res.langKey,
  };
}

export async function extractTextFromImage(
  imageDataUrl: string,
  langCode: string = 'auto',
  onProgress?: (statusText: string) => void
): Promise<string> {
  const res = await extractTextAndBlocksFromImage(imageDataUrl, langCode, onProgress);
  return res.fullText;
}

export async function terminateOcrWorker() {
  const workers = Array.from(workerPool.values());
  workerPool.clear();
  initLocks.clear();
  await Promise.all(
    workers.map(async (w) => {
      try {
        await w.terminate();
      } catch (e) {}
    })
  );
}
