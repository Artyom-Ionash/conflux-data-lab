import { useEffect, useRef } from 'react';

import { fetchFileFromUrl, isValidUrl } from '@/core/browser/clipboard';
import { isInstanceOf } from '@/core/primitives/guards';
import { scanEntries } from '@/lib/context-generator/scanner';

// Локальный интерфейс для Webkit API
interface WebkitDataTransferItem extends DataTransferItem {
  webkitGetAsEntry(): FileSystemEntry | null;
}

function hasWebkitGetAsEntry(item: DataTransferItem): item is WebkitDataTransferItem {
  return 'webkitGetAsEntry' in item;
}

interface UsePasteHandlerProps {
  onFilesReceived: (files: File[]) => void;
  shouldSkip?: ((path: string) => boolean) | undefined;
  enabled?: boolean;
}

/**
 * Хук для глобального перехвата вставки (Ctrl+V).
 * Оптимизирован для скорости: разделяет обработку файлов и ссылок.
 */
export function usePasteHandler({
  onFilesReceived,
  shouldSkip,
  enabled = true,
}: UsePasteHandlerProps) {
  // Используем ref для зависимостей, чтобы эффект подписки был стабилен
  const depsRef = useRef({ onFilesReceived, shouldSkip });

  useEffect(() => {
    depsRef.current = { onFilesReceived, shouldSkip };
  }, [onFilesReceived, shouldSkip]);

  useEffect(() => {
    if (!enabled) return;

    const handlePaste = async (e: ClipboardEvent) => {
      // Это безопасно проверяет, является ли цель DOM-элементом
      const target = e.target;
      // Игнорируем ввод в поля
      if (
        isInstanceOf(target, HTMLElement) &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (!e.clipboardData) return;

      const items = Array.from(e.clipboardData.items);
      const hasFiles = items.some((item) => item.kind === 'file');

      // 1. СЦЕНАРИЙ: ФАЙЛЫ
      if (hasFiles) {
        e.preventDefault();

        // Важно: извлекаем Entry СИНХРОННО, пока событие живо
        const entries = items
          .map((item) => (hasWebkitGetAsEntry(item) ? item.webkitGetAsEntry() : null))
          .filter((entry): entry is FileSystemEntry => entry !== null);

        // Если удалось получить Entry (Chrome/Edge/Safari) -> используем сканнер
        if (entries.length > 0) {
          // Передаем shouldSkip в сканер! Это предотвратит сканирование node_modules
          scanEntries(entries, depsRef.current.shouldSkip)
            .then((files) => {
              if (files.length > 0) depsRef.current.onFilesReceived(files);
            })
            .catch(console.error);
        } else {
          // Fallback (Firefox или старые браузеры) -> плоский список
          const directFiles = items
            .filter((item) => item.kind === 'file')
            .map((item) => item.getAsFile())
            .filter((f): f is File => f !== null);

          // FIX: Сохраняем функцию в локальную переменную для безопасного сужения типа
          const skipFn = depsRef.current.shouldSkip;

          const filteredFiles = skipFn ? directFiles.filter((f) => !skipFn(f.name)) : directFiles;

          if (filteredFiles.length > 0) depsRef.current.onFilesReceived(filteredFiles);
        }
      }
      // 2. СЦЕНАРИЙ: ССЫЛКИ (Только если нет файлов)
      else {
        const textItem = items.find((item) => item.kind === 'string' && item.type === 'text/plain');
        if (textItem) {
          textItem.getAsString(async (text) => {
            if (isValidUrl(text)) {
              e.preventDefault();
              const file = await fetchFileFromUrl(text);
              if (file) depsRef.current.onFilesReceived([file]);
            }
          });
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [enabled]);
}
