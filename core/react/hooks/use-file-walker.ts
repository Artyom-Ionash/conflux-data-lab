/**
 * Универсальный хук для асинхронного перебора файлов без блокировки UI.
 */
import { useCallback, useRef, useState } from 'react';

export type WalkerStatus = 'idle' | 'walking' | 'completed' | 'error';

interface WalkerOptions<T> {
  filter?: (file: File, path: string) => boolean;
  transform?: (file: File, path: string) => T | Promise<T>;
}

export function useFileWalker<T = File>(options: WalkerOptions<T> = {}) {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<WalkerStatus>('idle');
  const [progress, setProgress] = useState(0);
  const abortController = useRef<AbortController | null>(null);

  const walk = useCallback(
    async (fileList: FileList | File[]) => {
      if (abortController.current) abortController.current.abort();
      abortController.current = new AbortController();

      const { signal } = abortController.current;
      const rawArray = Array.from(fileList);
      const total = rawArray.length;
      const result: T[] = [];

      setStatus('walking');
      setProgress(0);

      try {
        for (let i = 0; i < total; i++) {
          if (signal.aborted) return;

          const file = rawArray[i];
          if (!file) continue;
          const path = file.webkitRelativePath || file.name;
          // Нормализация пути (убираем имя корневой папки)
          const parts = path.split('/');
          const normalizedPath = parts.length > 1 ? parts.slice(1).join('/') : path;

          if (!options.filter || options.filter(file, normalizedPath)) {
            const item = options.transform
              ? await options.transform(file, normalizedPath)
              : (file as unknown as T);
            result.push(item);
          }

          // Обновляем UI каждые 100 файлов
          if (i % 100 === 0 || i === total - 1) {
            setProgress(Math.round((i / total) * 100));
            await new Promise((r) => requestAnimationFrame(r));
          }
        }
        setItems(result);
        setStatus('completed');
      } catch (e) {
        if (e instanceof Error && e.message === 'AbortError') return;
        setStatus('error');
      }
    },
    [options]
  );

  const reset = useCallback(() => {
    setItems([]);
    setStatus('idle');
    setProgress(0);
  }, []);

  return { items, status, progress, walk, reset };
}
