/// <reference lib="webworker" />

import type { ContextFile } from './_assembly';
import { processFileToContext } from './_assembly';

// Входные данные: пачка файлов для обработки
export interface ProcessingPayload {
  files: File[];
}

// Выходные данные: обработанные файлы (без лишнего контента)
export interface ProcessingResponse {
  results: ContextFile[];
  error?: string;
}

// FIX: Строгая типизация глобальной области воркера
declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (e: MessageEvent<ProcessingPayload>) => {
  try {
    const { files } = e.data;

    // Параллельное чтение и обработка внутри воркера
    const results = await Promise.all(
      files.map(async (file) => {
        const text = await file.text();
        const raw = {
          name: file.name,
          path: file.webkitRelativePath || file.name,
          content: text,
          extension: file.name.split('.').pop() || '',
        };

        // Тяжелая операция (Regex + Parsing)
        return processFileToContext(raw);
      })
    );

    self.postMessage({ results });
  } catch (error) {
    self.postMessage({
      results: [],
      error: error instanceof Error ? error.message : 'Worker processing failed',
    });
  }
};
