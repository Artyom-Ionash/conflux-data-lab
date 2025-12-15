/**
 * Утилиты для работы с медиа-контентом (Изображения, Файлы).
 */

import { RGB } from './colors';

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

  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return { r, g, b };
}
