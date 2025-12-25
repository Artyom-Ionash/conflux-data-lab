/**
 * Универсальный движок для извлечения файлов из различных источников ввода.
 */

import ignore from 'ignore';

import { LOCAL_CONTEXT_FOLDER, MANDATORY_REPO_FILES } from './rules';

export interface ScanOptions {
  ignorePatterns?: string[];
  gitIgnoreContent?: string | null;
  shouldSkip?: (path: string) => boolean;
}

// --- Types for Modern API (Polyfill-like definitions for safety) ---
interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  values(): AsyncIterableIterator<FileSystemHandle>;
}

/**
 * Создает менеджер игнорирования.
 */
export function createIgnoreManager(options: ScanOptions) {
  const ig = ignore();
  // 1. БАЗОВЫЕ ЗАПРЕТЫ (Самый низкий приоритет)
  ig.add(['node_modules', '.DS_Store', 'package-lock.json', 'yarn.lock']);

  // 2. КОНТЕНТ ИЗ .gitignore
  if (options.gitIgnoreContent) {
    ig.add(options.gitIgnoreContent);
  }

  // 3. КАСТОМНЫЕ ПАТТЕРНЫ ИЗ ПРЕСЕТОВ И UI
  if (options.ignorePatterns) {
    ig.add(options.ignorePatterns.filter(Boolean));
  }

  // 4. ПРИНУДИТЕЛЬНОЕ ВКЛЮЧЕНИЕ (Самый высокий приоритет)
  // Эти правила добавляются ПОСЛЕДНИМИ, чтобы перекрыть .gitignore
  if (MANDATORY_REPO_FILES.length > 0) {
    ig.add(MANDATORY_REPO_FILES.map((f) => `!${f}`));
  }

  // Разрешаем папку .ai
  ig.add(`!${LOCAL_CONTEXT_FOLDER}`);
  ig.add(`!${LOCAL_CONTEXT_FOLDER}/**`);

  // 5. ФИНАЛЬНЫЙ БАН (Исключение из исключений)
  // Гарантируем, что .git не попадет в контекст, даже если он внутри .ai
  ig.add(['.git', '.git/**']);

  return ig;
}

/**
 * [MODERN API] Рекурсивно сканирует FileSystemDirectoryHandle.
 * Патчит файлы, добавляя webkitRelativePath для совместимости.
 */
export async function scanDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  shouldSkip?: (path: string) => boolean
): Promise<File[]> {
  const files: File[] = [];
  const rootName = dirHandle.name;

  async function walk(handle: FileSystemHandle, pathSegments: string[]) {
    // Формируем путь: Root/Folder/File.ext
    const currentPath = pathSegments.join('/');

    // Проверка на игнорирование (исключая корневую папку из проверки пути)
    // Мы передаем путь без имени корня для проверки, чтобы логика совпадала с input webkitdirectory
    const checkPath = pathSegments.length > 1 ? pathSegments.slice(1).join('/') : currentPath;

    if (pathSegments.length > 1 && shouldSkip?.(checkPath)) {
      return;
    }

    if (handle.kind === 'file') {
      const fileHandle = handle as FileSystemFileHandle;
      const file = await fileHandle.getFile();

      // MONKEY PATCH: Эмулируем поведение input[webkitdirectory]
      // Свойство webkitRelativePath доступно только для чтения, используем defineProperty
      Object.defineProperty(file, 'webkitRelativePath', {
        value: currentPath,
        writable: false,
        configurable: true,
        enumerable: true,
      });

      files.push(file);
    } else if (handle.kind === 'directory') {
      const dirHandle = handle as FileSystemDirectoryHandle;
      const promises: Promise<void>[] = [];

      for await (const entry of dirHandle.values()) {
        promises.push(walk(entry, [...pathSegments, entry.name]));
      }

      await Promise.all(promises);
    }
  }

  await walk(dirHandle, [rootName]);
  return files;
}

/**
 * Рекурсивно сканирует записи Entry (Drag-and-Drop API) с ранним игнорированием.
 */
export async function scanEntries(
  entries: FileSystemEntry[],
  shouldSkip?: (path: string) => boolean
): Promise<File[]> {
  const files: File[] = [];

  async function readEntry(entry: FileSystemEntry) {
    const path = entry.fullPath.startsWith('/') ? entry.fullPath.slice(1) : entry.fullPath;

    // Early Exit: не заходим в папки, которые не хотим видеть
    if (shouldSkip?.(path)) return;

    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject)
      );

      // Восстанавливаем путь для DND
      Object.defineProperty(file, 'webkitRelativePath', {
        value: path,
        writable: false,
        configurable: true,
        enumerable: true,
      });

      files.push(file);
    } else if (entry.isDirectory) {
      const directoryReader = (entry as FileSystemDirectoryEntry).createReader();
      const readBatch = async (): Promise<FileSystemEntry[]> => {
        return new Promise((resolve, reject) => directoryReader.readEntries(resolve, reject));
      };

      let batch = await readBatch();
      while (batch.length > 0) {
        await Promise.all(batch.map((child) => readEntry(child)));
        batch = await readBatch();
      }
    }
  }

  await Promise.all(entries.map((entry) => readEntry(entry)));
  return files;
}

/**
 * Фильтрует стандартный список файлов (FileList API) перед загрузкой в память.
 */
export function filterFileList(files: File[], shouldSkip: (path: string) => boolean): File[] {
  return files.filter((file) => {
    const path = file.webkitRelativePath || file.name;
    return !shouldSkip(path);
  });
}
