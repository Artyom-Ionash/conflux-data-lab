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

// --- Modern API Guards ---
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

function isFileHandle(handle: FileSystemHandle): handle is FileSystemFileHandle {
  return handle.kind === 'file';
}

function isDirectoryHandle(handle: FileSystemHandle): handle is FileSystemDirectoryHandle {
  return handle.kind === 'directory';
}

// --- Legacy API Guards (Drag-and-Drop) ---

function isFileEntry(entry: FileSystemEntry): entry is FileSystemFileEntry {
  return entry.isFile;
}

function isDirectoryEntry(entry: FileSystemEntry): entry is FileSystemDirectoryEntry {
  return entry.isDirectory;
}

/**
 * Создает менеджер игнорирования.
 */
export function createIgnoreManager(options: ScanOptions) {
  const ig = ignore();
  ig.add(['node_modules', '.DS_Store', 'package-lock.json', 'yarn.lock']);

  if (options.gitIgnoreContent) {
    ig.add(options.gitIgnoreContent);
  }

  if (options.ignorePatterns) {
    ig.add(options.ignorePatterns.filter(Boolean));
  }

  if (MANDATORY_REPO_FILES.length > 0) {
    ig.add(MANDATORY_REPO_FILES.map((f) => `!${f}`));
  }

  ig.add(`!${LOCAL_CONTEXT_FOLDER}`);
  ig.add(`!${LOCAL_CONTEXT_FOLDER}/**`);
  ig.add(['.git', '.git/**']);

  return ig;
}

/**
 * [MODERN API] Рекурсивно сканирует FileSystemDirectoryHandle.
 */
export async function scanDirectoryHandle(
  dirHandle: FileSystemDirectoryHandle,
  shouldSkip?: (path: string) => boolean
): Promise<File[]> {
  const files: File[] = [];
  const rootName = dirHandle.name;

  async function walk(handle: FileSystemHandle, pathSegments: string[]) {
    const currentPath = pathSegments.join('/');
    const checkPath = pathSegments.length > 1 ? pathSegments.slice(1).join('/') : currentPath;

    if (pathSegments.length > 1 && shouldSkip?.(checkPath)) {
      return;
    }

    if (isFileHandle(handle)) {
      const file = await handle.getFile();
      Object.defineProperty(file, 'webkitRelativePath', {
        value: currentPath,
        writable: false,
        configurable: true,
        enumerable: true,
      });
      files.push(file);
    } else if (isDirectoryHandle(handle)) {
      const promises: Promise<void>[] = [];
      for await (const entry of handle.values()) {
        promises.push(walk(entry, [...pathSegments, entry.name]));
      }
      await Promise.all(promises);
    }
  }

  await walk(dirHandle, [rootName]);
  return files;
}

/**
 * Рекурсивно сканирует записи Entry (Drag-and-Drop API).
 */
export async function scanEntries(
  entries: FileSystemEntry[],
  shouldSkip?: (path: string) => boolean
): Promise<File[]> {
  const files: File[] = [];

  async function readEntry(entry: FileSystemEntry) {
    const path = entry.fullPath.startsWith('/') ? entry.fullPath.slice(1) : entry.fullPath;

    if (shouldSkip?.(path)) return;

    if (isFileEntry(entry)) {
      const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject));

      Object.defineProperty(file, 'webkitRelativePath', {
        value: path,
        writable: false,
        configurable: true,
        enumerable: true,
      });

      files.push(file);
    } else if (isDirectoryEntry(entry)) {
      const directoryReader = entry.createReader();
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
 * Фильтрует стандартный список файлов (FileList API).
 */
export function filterFileList(files: File[], shouldSkip: (path: string) => boolean): File[] {
  return files.filter((file) => {
    const path = file.webkitRelativePath || file.name;
    return !shouldSkip(path);
  });
}
