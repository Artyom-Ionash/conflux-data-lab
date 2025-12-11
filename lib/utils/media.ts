/**
 * Утилиты для работы с медиа-контентом (Изображения, Файлы).
 */

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
  
  // ИСПРАВЛЕНИЕ 2: Использование Node#append()
  document.body.append(a); 
  
  a.click();
  
  // ИСПРАВЛЕНИЕ 3: Использование childNode.remove()
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