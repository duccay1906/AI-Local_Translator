import http from 'http';
import https from 'https';
import { URL } from 'url';

export interface StreamTranslateParams {
  baseUrl: string;
  model: string;
  text: string;
  targetLanguage: string;
  systemPromptTemplate?: string;
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
  let { baseUrl, model, text, targetLanguage, systemPromptTemplate, onChunk, onComplete, onError } = params;

  const defaultSystemPrompt = `You are a professional AI translator. Translate the user's text accurately into ${targetLanguage}. Maintain original tone, formatting, and nuances. Output ONLY the translation without introductory words or notes.`;
  const systemPrompt = systemPromptTemplate
    ? systemPromptTemplate.replace('{targetLanguage}', targetLanguage)
    : defaultSystemPrompt;

  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const endpoint = `${cleanUrl}/v1/chat/completions`;
  const parsedUrl = new URL(endpoint);
  const transport = parsedUrl.protocol === 'https:' ? https : http;

  const requestModel = (targetModel: string, isRetry = false): { abort: () => void } => {
    const postData = JSON.stringify({
      model: targetModel || '',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: text },
      ],
      temperature: 0.3,
      stream: true,
    });

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
            requestModel('', true);
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
