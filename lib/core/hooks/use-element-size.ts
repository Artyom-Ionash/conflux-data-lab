// Убрали useEffect из импортов
import { useCallback, useState } from 'react';

interface Size {
  width: number;
  height: number;
}

/**
 * Хук для отслеживания размеров DOM-элемента через ResizeObserver.
 * Возвращает [ref, size].
 */
export function useElementSize<T extends HTMLElement = HTMLDivElement>(): [
  (node: T | null) => void,
  Size,
] {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  // Используем callback ref вместо useRef, чтобы узнать, когда элемент реально смонтирован
  const ref = useCallback((node: T | null) => {
    if (!node) return;

    // Инициализируем начальный размер
    setSize({
      width: node.offsetWidth,
      height: node.offsetHeight,
    });

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      // В строгом режиме TS доступ по индексу может быть undefined
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(node);

    // Cleanup делается автоматически при размонтировании ноды (ResizeObserver GC)
  }, []);

  return [ref, size];
}
