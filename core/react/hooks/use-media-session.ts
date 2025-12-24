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

    const element = type === 'video' ? document.createElement('video') : new Image();
    element.src = url;

    const onLoaded = () => {
      if (!active) return;

      let dims: MediaDimensions;

      if (type === 'video') {
        const v = element as HTMLVideoElement;
        dims = { width: v.videoWidth, height: v.videoHeight, duration: v.duration };
      } else {
        const i = element as HTMLImageElement;
        dims = { width: i.naturalWidth, height: i.naturalHeight };
      }

      setState({ url, dimensions: dims, isLoading: false, error: null });
    };

    const onError = () => {
      if (!active) return;
      setState((s) => ({ ...s, isLoading: false, error: `Failed to load ${type}` }));
    };

    if (type === 'video') {
      const v = element as HTMLVideoElement;
      v.onloadedmetadata = onLoaded;
      v.onerror = onError;
      // Для видео важно сразу начать загрузку метаданных, так как нет автоплея
      v.load();
    } else {
      const i = element as HTMLImageElement;
      i.onload = onLoaded;
      i.onerror = onError;
    }

    return () => {
      active = false;
      cancelAnimationFrame(loadingRafId); // Очищаем таймер при размонтировании
      if (type === 'video') {
        const v = element as HTMLVideoElement;
        v.pause();
        v.src = '';
        v.load();
      }
    };
  }, [file, url, type]);

  return state;
}
