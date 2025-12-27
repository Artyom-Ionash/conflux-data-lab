/**
 * Утилиты для работы с медиа-контентом.
 */

import type { RGB } from '@/core/primitives/colors';
import { isObject } from '@/core/primitives/guards';

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
 * Внутренняя утилита для триггера скачивания
 */
function triggerDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
}

/**
 * Скачивание Data URL (Base64).
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  triggerDownload(dataUrl, filename);
}

/**
 * Скачивание Blob объекта.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

/**
 * Скачивание простого текста.
 */
export function downloadText(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, filename);
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
 * Извлекает RGB-цвет конкретного пикселя источника (по умолчанию 0,0).
 * Использует кроппинг 1x1 вместо масштабирования всего изображения.
 */
export function getTopLeftPixelColor(source: CanvasImageSource): RGB {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  // Важно: избежание искажений
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) return { r: 255, g: 255, b: 255 }; // Fallback (White)

  // Используем сигнатуру drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
  // Это копирует ровно 1 пиксель из координат 0,0 источника в 0,0 холста.
  ctx.drawImage(source, 0, 0, 1, 1, 0, 0, 1, 1);

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
 * Проверяет наличие размеров у объекта (для VideoFrame или ImageBitmap).
 */
function hasDimensions(source: unknown): source is { width: number; height: number } {
  return (
    isObject(source) && typeof source['width'] === 'number' && typeof source['height'] === 'number'
  );
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

  // Если размеры не переданы, пытаемся извлечь их из источника
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
    } else if (hasDimensions(source)) {
      // TS Narrowing
      targetWidth = source.width;
      targetHeight = source.height;
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
