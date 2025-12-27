import { useEffect, useState } from 'react';

import { useObjectUrl } from './use-object-url';

export interface MediaDimensions {
  width: number;
  height: number;
  duration?: number; // Только для видео
}

interface MediaSessionState {
  url: string | null;
  dimensions: MediaDimensions | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Универсальный хук для инициализации медиа-ресурсов из File.
 *
 * Абстрагирует:
 * 1. Управление жизненным циклом Blob URL (через useObjectUrl).
 * 2. Загрузку метаданных (HTMLImageElement / HTMLVideoElement).
 * 3. Обработку ошибок загрузки.
 */
export function useMediaSession(file: File | null, type: 'video' | 'image') {
  const url = useObjectUrl(file);
  const [state, setState] = useState<MediaSessionState>({
    url: null,
    dimensions: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    // Сброс при отсутствии файла
    if (!file || !url) {
      const rafId = requestAnimationFrame(() => {
        setState((s) => {
          // Оптимизация: не обновляем стейт, если он уже пуст
          if (s.url === null && s.error === null) return s;
          return { url: null, dimensions: null, isLoading: false, error: null };
        });
      });
      return () => cancelAnimationFrame(rafId);
    }

    let active = true;

    // Оборачиваем установку isLoading в RAF, чтобы избежать синхронного обновления стейта в эффекте
    const loadingRafId = requestAnimationFrame(() => {
      if (active) {
        setState((s) => ({ ...s, isLoading: true, error: null }));
      }
    });

    // Разделение логики для строгой типизации
    let cleanup: () => void = () => {};

    const handleSuccess = (dims: MediaDimensions) => {
      if (active) setState({ url, dimensions: dims, isLoading: false, error: null });
    };

    const handleError = () => {
      if (active) setState((s) => ({ ...s, isLoading: false, error: `Failed to load ${type}` }));
    };

    if (type === 'video') {
      const video = document.createElement('video');
      video.src = url;

      const onLoaded = () => {
        handleSuccess({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
        });
      };

      video.onloadedmetadata = onLoaded;
      video.onerror = handleError;
      video.load();

      cleanup = () => {
        video.pause();
        video.src = '';
        video.load();
      };
    } else {
      const img = new Image();
      img.src = url;

      img.onload = () => {
        handleSuccess({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = handleError;
    }

    return () => {
      active = false;
      cancelAnimationFrame(loadingRafId);
      cleanup();
    };
  }, [file, url, type]);

  return state;
}
