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
    // Важно для манипуляций с canvas (избегание Tainted Canvas)
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    // Игнорируем параметр ошибки, используя только 'reject'
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * Создает невидимую ссылку и инициирует скачивание файла.
 * Работает как с Blob URL, так и с Data URL.
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
 * Безопасно освобождает URL объекта, подавляя ошибки.
 */
export function revokeObjectURLSafely(url: string | null | undefined) {
  if (!url) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Игнорируем ошибки, если URL уже был удален
  }
}

/**
 * Извлекает RGB-цвет верхнего левого пикселя (0,0) изображения.
 * Использует микро-канвас 1x1 для производительности.
 * Возвращает {r, g, b} для удобства вычислений.
 */
export function getTopLeftPixelColor(source: CanvasImageSource): RGB {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) return { r: 255, g: 255, b: 255 }; // Fallback (White)

  // Рисуем кусочек 1x1 из координат 0,0 источника в координаты 0,0 канваса
  ctx.drawImage(source, 0, 0, 1, 1, 0, 0, 1, 1);

  const data = ctx.getImageData(0, 0, 1, 1).data;

  // FIX: Используем nullish coalescing (?? 0), так как TS не гарантирует наличие индекса
  const r = data[0] ?? 255;
  const g = data[1] ?? 255;
  const b = data[2] ?? 255;

  return { r, g, b };
}

/**
 * Ожидает, пока видеокадр будет действительно готов к отрисовке.
 * Использует `requestVideoFrameCallback` для точной синхронизации с композитором браузера.
 * Включает Safety Timeout для предотвращения зависания.
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

    // 1. Safety Timeout: Если API зависнет (например, вкладка в фоне),
    // принудительно продолжаем через 200мс, чтобы не сломать UX.
    const timeoutId = setTimeout(safeResolve, 200);

    const onFrame = () => {
      clearTimeout(timeoutId);
      safeResolve();
    };

    // 2. Modern API
    if (
      'requestVideoFrameCallback' in video &&
      typeof video.requestVideoFrameCallback === 'function'
    ) {
      video.requestVideoFrameCallback(onFrame);
    } else {
      // 3. Fallback: Double RAF
      requestAnimationFrame(() => {
        requestAnimationFrame(onFrame);
      });
    }
  });
}
