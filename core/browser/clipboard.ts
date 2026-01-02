/**
 * Утилиты для работы с буфером обмена и обработки вставки.
 */

// Простая регулярка для URL
const URL_REGEX = /^(https?:\/\/[^\s]+)$/i;

export function isValidUrl(text: string): boolean {
  return URL_REGEX.test(text.trim());
}

/**
 * Пытается скачать файл через наш прокси или напрямую.
 */
export async function fetchFileFromUrl(url: string): Promise<File | null> {
  try {
    const filename = url.split('/').pop()?.split('?')[0] || 'downloaded-file';

    // Используем наш прокси
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;

    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error('Fetch failed');

    const blob = await res.blob();
    const contentType = res.headers.get('content-type') || blob.type;

    // Определяем расширение если его нет в имени
    let finalName = filename;
    if (!filename.includes('.') && contentType.includes('/')) {
      finalName = `${filename}.${contentType.split('/')[1]}`;
    }

    return new File([blob], finalName, { type: contentType });
  } catch (error) {
    console.warn('Failed to fetch file from URL:', url, error);
    return null;
  }
}

/**
 * Извлекает файлы из DataTransfer (событие paste/drop).
 * Обрабатывает и прямые файлы, и ссылки (text/plain).
 */
export async function extractFilesFromDataTransfer(items: DataTransferItemList): Promise<File[]> {
  const files: File[] = [];
  const promises: Promise<void>[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // FIX: Строгая проверка на undefined
    if (!item) continue;

    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) files.push(file);
    } else if (item.kind === 'string' && item.type === 'text/plain') {
      // Обработка ссылок асинхронна
      const promise = new Promise<void>((resolve) => {
        item.getAsString(async (text) => {
          if (isValidUrl(text)) {
            const file = await fetchFileFromUrl(text);
            if (file) files.push(file);
          }
          resolve();
        });
      });
      promises.push(promise);
    }
  }

  await Promise.all(promises);
  return files;
}
