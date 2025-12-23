import { type Dirent, readdirSync, type Stats, statSync } from 'node:fs';
import { join } from 'node:path';

export interface FileEntry {
  path: string; // Абсолютный путь
  relPath: string; // Относительный путь (для фильтрации)
  name: string; // Имя файла/папки
  stats: Stats;
  isDirectory: boolean;
}

interface WalkOptions {
  /**
   * Предикат фильтрации.
   * Если возвращает true, файл/папка пропускается и (в случае папки) не сканируется глубже.
   */
  shouldIgnore?: (relPath: string, isDirectory: boolean) => boolean;
}

/**
 * Синхронный генератор для рекурсивного обхода директорий.
 * Использование generator function (*) позволяет обрабатывать файлы по одному,
 * не загружая всё дерево в память (Lazy Evaluation).
 */
export function* walkSync(
  dir: string,
  rootDir = dir,
  options: WalkOptions = {}
): Generator<FileEntry> {
  let entries: Dirent[] = [];

  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    // Игнорируем ошибки доступа к системным папкам
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    // Нормализация пути к POSIX формату (forward slashes) для корректной работы ignore паттернов
    const relPath = fullPath.substring(rootDir.length + 1).replaceAll('\\', '/');
    const isDirectory = entry.isDirectory();

    // Ранний выход (Pruning)
    if (options.shouldIgnore?.(relPath, isDirectory)) {
      continue;
    }

    if (isDirectory) {
      // Рекурсивный вызов (yield* делегирует выполнение другому генератору)
      yield* walkSync(fullPath, rootDir, options);
    } else {
      yield {
        path: fullPath,
        relPath,
        name: entry.name,
        stats: statSync(fullPath),
        isDirectory: false,
      };
    }
  }
}
