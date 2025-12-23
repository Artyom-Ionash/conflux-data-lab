import { useEffect, useState } from 'react';

import { getTopLeftPixelColor, loadImage } from '@/core/browser/canvas';
import { rgbToHex } from '@/core/primitives/colors';

import { useObjectUrl } from './use-object-url';

interface FileMetadata {
  url: string | null;
  width: number;
  height: number;
  bgColor: string | null;
  isLoading: boolean;
}

/**
 * Автоматически извлекает визуальные параметры из выбранного файла.
 * Использует requestAnimationFrame для предотвращения каскадных рендеров.
 */
export function useFileMetadata(file: File | null) {
  const url = useObjectUrl(file);
  const [metadata, setMetadata] = useState<Omit<FileMetadata, 'url'>>({
    width: 0,
    height: 0,
    bgColor: null,
    isLoading: false,
  });

  useEffect(() => {
    let isMounted = true;

    if (!url) {
      // Используем RAF для избежания синхронного каскада рендеров
      requestAnimationFrame(() => {
        if (isMounted) {
          setMetadata({ width: 0, height: 0, bgColor: null, isLoading: false });
        }
      });
      return;
    }

    requestAnimationFrame(() => {
      if (isMounted) {
        setMetadata((prev) => ({ ...prev, isLoading: true }));
      }
    });

    void (async () => {
      try {
        const img = await loadImage(url);
        if (!isMounted) return;

        const { r, g, b } = getTopLeftPixelColor(img);

        setMetadata({
          width: img.naturalWidth,
          height: img.naturalHeight,
          bgColor: rgbToHex(r, g, b),
          isLoading: false,
        });
      } catch (e) {
        console.error('Failed to extract metadata', e);
        if (isMounted) {
          setMetadata((prev) => ({ ...prev, isLoading: false }));
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [url]);

  return { url, ...metadata };
}
