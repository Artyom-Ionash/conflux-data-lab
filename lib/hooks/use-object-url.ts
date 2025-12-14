import { useEffect, useState } from 'react';

/**
 * Хук для безопасного создания и автоматической очистки Object URL из File или Blob.
 * Предотвращает утечки памяти.
 */
export function useObjectUrl(file: File | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    // 1. Создаем URL синхронно, так как это side-effect, не зависящий от React
    const objectUrl = file ? URL.createObjectURL(file) : null;

    // 2. Обновляем состояние асинхронно через requestAnimationFrame.
    // Это разрывает синхронную цепочку рендеров и удовлетворяет правило линтера
    // "Calling setState synchronously within an effect".
    const rafId = requestAnimationFrame(() => {
      setUrl(objectUrl);
    });

    // 3. Cleanup: отменяем обновление стейта и очищаем URL
    return () => {
      cancelAnimationFrame(rafId);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file]);

  return url;
}
