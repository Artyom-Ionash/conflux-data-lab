import { isArrayOf, isObject, isString } from '@/core/primitives/guards';

// --- Types & Interfaces ---

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  siteUrl?: string;
  siteName?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Структура ошибки API
interface APIErrorResponse {
  error: {
    message: string;
    code?: number;
  };
}

// Структура успешного чанка (Delta)
interface ChatCompletionChunk {
  id: string;
  choices: Array<{
    delta: {
      content?: string;
    };
    finish_reason?: string | null;
  }>;
}

export const GEMINI_MODELS = [
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash', context: 1000000 },
  { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5', context: 2000000 },
  { id: 'google/gemini-flash-1.5', name: 'Gemini Flash 1.5', context: 1000000 },
] as const;

// --- Type Guards (Runtime Validation) ---

/**
 * Проверяет, является ли ответ ошибкой API.
 */
function isAPIError(data: unknown): data is APIErrorResponse {
  return isObject(data) && isObject(data['error']) && isString(data['error']['message']);
}

/**
 * Проверяет структуру дельты (выбора) внутри чанка.
 */
function isChoiceDelta(data: unknown): data is ChatCompletionChunk['choices'][number] {
  return isObject(data) && isObject(data['delta']);
}

/**
 * Проверяет, является ли объект валидным чанком стрима.
 */
function isChatChunk(data: unknown): data is ChatCompletionChunk {
  return (
    isObject(data) && Array.isArray(data['choices']) && isArrayOf(data['choices'], isChoiceDelta)
  );
}

// --- Main Logic ---

export async function streamOpenRouterCompletion(
  messages: ChatMessage[],
  config: OpenRouterConfig,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'HTTP-Referer': config.siteUrl ?? 'http://localhost:3000',
      'X-Title': config.siteName ?? 'Conflux Data Lab',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
    }),
    // Fix for exactOptionalPropertyTypes
    signal: signal ?? null,
  });

  if (!response.ok) {
    const rawError: unknown = await response.json().catch(() => ({}));

    // Type Guard сужает тип rawError до APIErrorResponse
    if (isAPIError(rawError)) {
      throw new Error(rawError.error.message);
    }

    throw new Error(`OpenRouter Error: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('No response body received');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((line) => line.trim() !== '');

      for (const line of lines) {
        if (line === 'data: [DONE]') return;

        if (line.startsWith('data: ')) {
          try {
            const jsonStr = line.slice(6);
            const rawData: unknown = JSON.parse(jsonStr);

            // Type Guard валидирует структуру перед доступом
            if (isChatChunk(rawData)) {
              // Благодаря isArrayOf и noUncheckedIndexedAccess мы должны быть осторожны,
              // но isChatChunk гарантирует массив.
              // Берем 0-й элемент безопасно.
              const firstChoice = rawData.choices[0];

              if (firstChoice?.delta.content) {
                onChunk(firstChoice.delta.content);
              }
            }
          } catch (e) {
            console.warn('Stream parse warning:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
