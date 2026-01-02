import { useEffect, useRef } from 'react';

import { extractFilesFromDataTransfer } from '@/core/browser/clipboard';
import { isInstanceOf } from '@/core/primitives/guards';

interface UsePasteHandlerProps {
  onFilesReceived: (files: File[]) => void;
  enabled?: boolean;
}

/**
 * Хук для глобального перехвата вставки (Ctrl+V).
 */
export function usePasteHandler({ onFilesReceived, enabled = true }: UsePasteHandlerProps) {
  // Используем ref для коллбека, чтобы эффект не пересоздавался при смене onFilesReceived
  const callbackRef = useRef(onFilesReceived);

  useEffect(() => {
    callbackRef.current = onFilesReceived;
  }, [onFilesReceived]);

  useEffect(() => {
    if (!enabled) return;

    const handlePaste = async (e: ClipboardEvent) => {
      // Это безопасно проверяет, является ли цель DOM-элементом
      const target = e.target;
      if (
        isInstanceOf(target, HTMLElement) &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (!e.clipboardData) return;

      const files = await extractFilesFromDataTransfer(e.clipboardData.items);

      if (files.length > 0) {
        e.preventDefault();
        callbackRef.current(files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [enabled]);
}
