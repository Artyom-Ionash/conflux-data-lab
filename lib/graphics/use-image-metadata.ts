import { useEffect, useState } from 'react';

import { getTopLeftPixelColor, loadImage } from '@/core/browser/canvas';
import { rgbToHex } from '@/core/primitives/colors';
import { useObjectUrl } from '@/core/react/hooks/use-object-url';

export interface ImageMetadata {
  width: number;
  height: number;
  bgColor: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * [DOMAIN HOOK]
 * Адаптер для анализа изображений.
 * Живет в lib/graphics, так как это часть графического домена.
 */
export function useImageMetadata(file: File | null) {
  const isImage = file?.type.startsWith('image/');
  const url = useObjectUrl(isImage ? file : null);

  const [metadata, setMetadata] = useState<Omit<ImageMetadata, 'url'>>({
    width: 0,
    height: 0,
    bgColor: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    // Хелпер для безопасного обновления стейта без блокировки потока
    const safeSetMetadata = (newState: Partial<Omit<ImageMetadata, 'url'>>) => {
      requestAnimationFrame(() => {
        if (isMounted) {
          setMetadata((prev) => ({ ...prev, ...newState }));
        }
      });
    };

    if (!file) {
      safeSetMetadata({
        width: 0,
        height: 0,
        bgColor: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    if (!isImage) {
      safeSetMetadata({ error: 'Not an image file', isLoading: false });
      return;
    }

    if (!url) return;

    safeSetMetadata({ isLoading: true, error: null });

    void (async () => {
      try {
        const img = await loadImage(url);
        // Используем примитивы из ядра
        const { r, g, b } = getTopLeftPixelColor(img);

        if (!isMounted) return;

        // Асинхронный результат уже разорван с циклом рендера, RAF здесь не обязателен,
        // но допустим для единообразия.
        setMetadata({
          width: img.naturalWidth,
          height: img.naturalHeight,
          bgColor: rgbToHex(r, g, b),
          isLoading: false,
          error: null,
        });
      } catch {
        if (isMounted) {
          setMetadata((prev) => ({
            ...prev,
            isLoading: false,
            error: 'Failed to decode image',
          }));
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [url, file, isImage]);

  return { url, ...metadata };
}
