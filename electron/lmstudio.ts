import http from 'http';
import https from 'https';
import { URL } from 'url';

import { OcrTextBlock, VisualBlockTranslation } from '../src/types';

export interface StreamTranslateParams {
  baseUrl: string;
  model: string;
  text: string;
  targetLanguage: string;
  systemPromptTemplate?: string;
  reasoningEffort?: string;
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

export async function fetchAvailableModels(baseUrl: string): Promise<string[]> {
  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const targetUrl = `${cleanUrl}/v1/models`;

  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(targetUrl);
      const transport = parsedUrl.protocol === 'https:' ? https : http;

      const req = transport.get(targetUrl, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body);
              if (data.data && Array.isArray(data.data)) {
                // Check if any model is explicitly marked as loaded in RAM/VRAM
                const loadedModels = data.data
                  .filter((m: any) => m.state === 'loaded' || m.loaded === true || m.status === 'loaded')
                  .map((m: any) => m.id);

                if (loadedModels.length > 0) {
                  resolve(loadedModels);
                } else {
                  // Return all model IDs if no state tag is present
                  resolve(data.data.map((m: any) => m.id));
                }
              } else {
                resolve([]);
              }
            } catch (err) {
              reject(new Error('Failed to parse models response JSON'));
            }
          } else {
            reject(new Error(`LM Studio returned status code ${res.statusCode}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Connection to LM Studio timed out. Is LM Studio server running?'));
      });
    } catch (e) {
      reject(e);
    }
  });
}

export async function streamTranslation(params: StreamTranslateParams): Promise<{ abort: () => void }> {
  let { baseUrl, model, text, targetLanguage, systemPromptTemplate, reasoningEffort, onChunk, onComplete, onError } = params;

  const defaultSystemPrompt = `You are a professional AI translator. Translate the user's text accurately into ${targetLanguage}. Maintain original tone, formatting, and nuances. Output ONLY the translation without introductory words or notes.`;
  const systemPrompt = systemPromptTemplate
    ? systemPromptTemplate.replace('{targetLanguage}', targetLanguage)
    : defaultSystemPrompt;

  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const endpoint = `${cleanUrl}/v1/chat/completions`;
  const parsedUrl = new URL(endpoint);
  const transport = parsedUrl.protocol === 'https:' ? https : http;

  const requestModel = (targetModel: string, isRetry = false, omitReasoningEffort = false): { abort: () => void } => {
    const payloadObj: Record<string, any> = {
      model: targetModel || '',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      stream: true,
    };

    if (!omitReasoningEffort) {
      payloadObj.reasoning_effort = reasoningEffort || 'none';
    }

    const postData = JSON.stringify(payloadObj);

    const options: http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    let fullTranslatedText = '';
    let buffer = '';

    const req = transport.request(options, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        let errBody = '';
        res.on('data', (d) => (errBody += d));
        res.on('end', () => {
          // If a specific model failed to load in LM Studio (status 400), retry with empty model string to use currently loaded model
          if (!isRetry && res.statusCode === 400 && errBody.includes('Failed to load model')) {
            console.warn('Model load failed in LM Studio, retrying with active loaded model...');
            requestModel('', true, omitReasoningEffort);
            return;
          }
          // Fallback if a backend rejects reasoning_effort field
          if (!omitReasoningEffort && res.statusCode === 400 && errBody.includes('reasoning_effort')) {
            console.warn('Backend rejected reasoning_effort, retrying without it...');
            requestModel(targetModel, isRetry, true);
            return;
          }
          onError(new Error(`LM Studio returned status ${res.statusCode}: ${errBody}`));
        });
        return;
      }

      res.setEncoding('utf8');

      res.on('data', (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // keep last incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue;

          if (trimmed === 'data: [DONE]') {
            onComplete(fullTranslatedText);
            return;
          }

          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.substring(6);
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullTranslatedText += content;
                onChunk(content);
              }
            } catch (e) {
              // Ignore partial SSE JSON parse errors
            }
          }
        }
      });

      res.on('end', () => {
        // Process any remaining buffer
        if (buffer.trim().startsWith('data: ')) {
          const jsonStr = buffer.trim().substring(6);
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              fullTranslatedText += content;
              onChunk(content);
            }
          } catch (e) {}
        }
        onComplete(fullTranslatedText);
      });
    });

    req.on('error', (err) => {
      onError(err);
    });

    req.write(postData);
    req.end();

    return {
      abort: () => {
        req.destroy();
      },
    };
  };

  return requestModel(model || '');
}

export async function translateBlocks(params: {
  baseUrl: string;
  model: string;
  blocks: OcrTextBlock[];
  targetLanguage: string;
  reasoningEffort?: string;
  systemPromptTemplate?: string;
}): Promise<VisualBlockTranslation[]> {
  const { baseUrl, model, blocks, targetLanguage, reasoningEffort } = params;
  if (!blocks || blocks.length === 0) return [];

  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const endpoint = `${cleanUrl}/v1/chat/completions`;
  const parsedUrl = new URL(endpoint);
  const transport = parsedUrl.protocol === 'https:' ? https : http;

  // Single block case
  if (blocks.length === 1) {
    const single = blocks[0];
    return new Promise((resolve) => {
      const payload = {
        model: model || '',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the given text accurately into ${targetLanguage}. Maintain tone and context. Output ONLY the translated text without extra explanation.`,
          },
          { role: 'user', content: single.text },
        ],
        temperature: 0.3,
        reasoning_effort: reasoningEffort || 'none',
        stream: false,
      };

      const postData = JSON.stringify(payload);
      const req = transport.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (d) => (body += d));
          res.on('end', () => {
            try {
              const parsed = JSON.parse(body);
              const trans = parsed.choices?.[0]?.message?.content?.trim() || single.text;
              resolve([
                {
                  id: single.id,
                  bbox: single.bbox,
                  originalText: single.text,
                  translatedText: trans,
                },
              ]);
            } catch (e) {
              resolve([
                {
                  id: single.id,
                  bbox: single.bbox,
                  originalText: single.text,
                  translatedText: single.text,
                },
              ]);
            }
          });
        }
      );
      req.on('error', () => {
        resolve([
          {
            id: single.id,
            bbox: single.bbox,
            originalText: single.text,
            translatedText: single.text,
          },
        ]);
      });
      req.write(postData);
      req.end();
    });
  }

  // Multiple blocks case (Numbered lines [1], [2]...)
  const promptText = blocks.map((b) => `[${b.id}] ${b.text}`).join('\n');
  const systemPrompt = `You are an expert bilingual translator. Translate each numbered segment into ${targetLanguage}. Maintain original numbering format exactly:
[1] <translated segment 1>
[2] <translated segment 2>
Output ONLY the numbered translations without notes or greetings.`;

  return new Promise((resolve) => {
    const payload = {
      model: model || '',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptText },
      ],
      temperature: 0.3,
      reasoning_effort: reasoningEffort || 'none',
      stream: false,
    };

    const postData = JSON.stringify(payload);
    const req = transport.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (d) => (body += d));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const content = parsed.choices?.[0]?.message?.content || '';
            const translationsMap = new Map<number, string>();
            const regex = /\[(\d+)\]\s*([\s\S]*?)(?=(?:\[\d+\]|$))/g;
            let m;
            while ((m = regex.exec(content)) !== null) {
              const id = parseInt(m[1], 10);
              const text = m[2].trim();
              if (id && text) {
                translationsMap.set(id, text);
              }
            }

            const results: VisualBlockTranslation[] = blocks.map((b) => ({
              id: b.id,
              bbox: b.bbox,
              originalText: b.text,
              translatedText: translationsMap.get(b.id) || b.text,
            }));
            resolve(results);
          } catch (e) {
            resolve(
              blocks.map((b) => ({
                id: b.id,
                bbox: b.bbox,
                originalText: b.text,
                translatedText: b.text,
              }))
            );
          }
        });
      }
    );
    req.on('error', () => {
      resolve(
        blocks.map((b) => ({
          id: b.id,
          bbox: b.bbox,
          originalText: b.text,
          translatedText: b.text,
        }))
      );
    });
    req.write(postData);
    req.end();
  });
}

