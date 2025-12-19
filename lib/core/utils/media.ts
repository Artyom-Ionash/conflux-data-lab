/**
 * Утилиты для работы с медиа-контентом (Изображения, Файлы).
 */

import type { RGB } from './colors';

/**
 * Асинхронно загружает изображение и возвращает HTMLImageElement.
 * Автоматически обрабатывает crossOrigin.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Создает невидимую ссылку и инициирует скачивание файла.
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;

  document.body.append(a);
  a.click();
  a.remove();
}

/**
 * Безопасно освобождает URL объекта.
 */
export function revokeObjectURLSafely(url: string | null | undefined) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Игнорируем ошибки
  }
}

/**
 * Извлекает RGB-цвет верхнего левого пикселя (0,0) источника.
 */
export function getTopLeftPixelColor(source: CanvasImageSource): RGB {
  const { canvas, ctx } = captureToCanvas(source, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;

  return {
    r: data[0] ?? 255,
    g: data[1] ?? 255,
    b: data[2] ?? 255,
  };
}

/**
 * Ожидает, пока видеокадр будет готов к отрисовке.
 */
export function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false;
    const safeResolve = () => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    };

    const timeoutId = setTimeout(safeResolve, 200);

    const onFrame = () => {
      clearTimeout(timeoutId);
      safeResolve();
    };

    if (
      'requestVideoFrameCallback' in video &&
      typeof video.requestVideoFrameCallback === 'function'
    ) {
      video.requestVideoFrameCallback(onFrame);
    } else {
      requestAnimationFrame(() => {
        requestAnimationFrame(onFrame);
      });
    }
  });
}

/**
 * Создает закадровый холст (Offscreen Canvas) и "запекает" в него текущее состояние источника.
 * Название отражает универсальность: работает с Image, Video, Canvas и VideoFrame.
 */
export function captureToCanvas(
  source: CanvasImageSource,
  width?: number,
  height?: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');

  let targetWidth = width;
  let targetHeight = height;

  if (!targetWidth || !targetHeight) {
    if (source instanceof HTMLVideoElement) {
      targetWidth = source.videoWidth;
      targetHeight = source.videoHeight;
    } else if (source instanceof HTMLImageElement) {
      targetWidth = source.naturalWidth;
      targetHeight = source.naturalHeight;
    } else if (source instanceof HTMLCanvasElement) {
      targetWidth = source.width;
      targetHeight = source.height;
    } else if ('width' in source && typeof source.width === 'number') {
      targetWidth = source.width;
      targetHeight = source.height as number;
    }
  }

  canvas.width = targetWidth || 0;
  canvas.height = targetHeight || 0;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Failed to create canvas context');
  }

  if (targetWidth && targetHeight) {
    ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  }

  return { canvas, ctx };
}
