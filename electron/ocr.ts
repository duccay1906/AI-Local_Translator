import { createWorker, Worker } from 'tesseract.js';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

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

interface ScoredOcrResult {
  langKey: string;
  text: string;
  score: number;
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

    if (lines.length > 0) {
      const maxLineConf = Math.max(...lines.map((l) => l.confidence || 0));
      // Filter out low-confidence border/artifact noise lines if there are strong text lines
      const threshold = maxLineConf >= 65 ? 52 : 0;
      const validLines = lines.filter(
        (l) => (l.confidence || 0) >= threshold && l.text && l.text.trim().length > 0
      );

      if (validLines.length > 0) {
        const avgConf =
          validLines.reduce((sum, l) => sum + (l.confidence || 0), 0) / validLines.length;
        const combinedText = cleanOcrText(validLines.map((l) => l.text).join('\n'));
        return {
          langKey,
          text: combinedText,
          score: combinedText ? avgConf : 0,
        };
      }
    }

    const fallbackText = cleanOcrText(result?.data?.text || '');
    return {
      langKey,
      text: fallbackText,
      score: fallbackText ? result?.data?.confidence || 0 : 0,
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

export async function extractTextFromImage(
  imageDataUrl: string,
  langCode: string = 'auto',
  onProgress?: (statusText: string) => void
): Promise<string> {
  const normalizedLang = normalizeLangCode(langCode);
  const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Data, 'base64');

  if (normalizedLang === 'auto') {
    onProgress?.('Auto-detecting language & extracting text (KR/JP/CN/EN)...');
    const candidates = await Promise.all(
      AUTO_CANDIDATE_LANGS.map((key) =>
        recognizeWithWorker(key, imageBuffer, onProgress).catch(() => ({
          langKey: key,
          text: '',
          score: -1,
        }))
      )
    );

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    console.log(
      'Auto OCR scores:',
      candidates.map((c) => `${c.langKey}:${Math.round(c.score)}`).join(', '),
      '-> Winner:',
      best?.langKey
    );
    return best?.text || '';
  }

  onProgress?.(`Extracting text (${normalizedLang})...`);
  const res = await recognizeWithWorker(normalizedLang, imageBuffer, onProgress);
  return res.text;
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
