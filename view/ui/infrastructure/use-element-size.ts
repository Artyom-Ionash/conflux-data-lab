'use client';

import { useCallback, useState } from 'react';

interface Size {
  width: number;
  height: number;
}

/**
 * Хук для отслеживания размеров DOM-элемента через ResizeObserver.
 */
export function useElementSize<T extends HTMLElement = HTMLDivElement>(): [
  (node: T | null) => void,
  Size,
] {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });

  const ref = useCallback((node: T | null) => {
    if (!node) return;

    setSize({
      width: node.offsetWidth,
      height: node.offsetHeight,
    });

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(node);
  }, []);

  return [ref, size];
}
