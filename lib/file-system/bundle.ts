/**
 * Система управления наборами файлов.
 * Базовая логика отделена от платформенных API (Browser/Node).
 */

import { CONTEXT_PRESETS, type PresetKey } from '../context-generator/rules';
import { getLanguageTag, isTextFile } from './analyzers';

/**
 * Минимальный интерфейс файла, понятный и браузеру, и скрипту.
 */
export interface BaseFileNode {
  readonly path: string;
  readonly name: string;
  readonly size: number;
  readonly extension: string;
  readonly isText: boolean;
  readonly langTag: string;
}

/**
 * Базовое ядро для управления коллекцией файлов проекта.
 */
export abstract class BaseBundle<T extends BaseFileNode> {
  protected readonly nodes = new Map<string, T>();
  public readonly detectedPreset: PresetKey;

  constructor(rootFileNames: string[], presetOverride?: PresetKey) {
    this.detectedPreset = presetOverride || this.detectSignature(rootFileNames);
  }

  /**
   * Детекция "почерка" проекта по списку имен файлов.
   * Принимает ТОЛЬКО файлы корневого уровня.
   */
  protected detectSignature(rootNames: string[] | Set<string>): PresetKey {
    const nameSet = Array.isArray(rootNames) ? new Set(rootNames) : rootNames;

    // 1. Godot (Самый уникальный)
    if (nameSet.has('project.godot')) return 'godot';

    // 2. Python / UV Ecosystem
    if (
      nameSet.has('uv.lock') ||
      nameSet.has('poetry.lock') ||
      nameSet.has('requirements.txt') ||
      nameSet.has('pyproject.toml') ||
      nameSet.has('main.py') ||
      nameSet.has('app.py')
    ) {
      return 'python';
    }

    // 3. JavaScript / Web (Default fallback usually)
    if (
      nameSet.has('package.json') ||
      nameSet.has('next.config.ts') ||
      nameSet.has('tsconfig.json')
    ) {
      return 'nextjs';
    }

    return 'nextjs';
  }

  /**
   * Универсальная нормализация пути.
   */
  protected normalizePath(rawPath: string): string {
    const unixPath = rawPath.includes('\\') ? rawPath.replaceAll('\\', '/') : rawPath;

    // Если путь начинается с имени папки (как в input webkitdirectory),
    // отсекаем первый сегмент.
    const firstSlashIndex = unixPath.indexOf('/');
    if (firstSlashIndex !== -1) {
      return unixPath.substring(firstSlashIndex + 1);
    }
    return unixPath;
  }

  public getItems(): T[] {
    return [...this.nodes.values()];
  }

  public getPaths(): string[] {
    return [...this.nodes.keys()];
  }
}

/**
 * [SPECIFIC] Реализация для браузера.
 */
export interface BrowserNode extends BaseFileNode {
  readonly id: string;
  readonly file: File;
}

export class FileBundle extends BaseBundle<BrowserNode> {
  private readonly urls = new Map<string, string>();

  constructor(
    files: File[],
    options: { customExtensions?: string[]; presetOverride?: PresetKey } = {}
  ) {
    //  Нам нужно найти файлы, у которых не более одного разделителя пути.
    // "Root/file.txt" -> 1 слэш -> OK
    // "Root/Sub/file.txt" -> 2 слэша -> Skip
    const rootCandidates = files
      .filter((f) => {
        const path = f.webkitRelativePath || f.name;
        // Нормализация слэшей нужна только для Windows-путей при paste,
        // webkitRelativePath обычно всегда использует '/'.
        const unixPath = path.includes('\\') ? path.replaceAll('\\', '/') : path;

        const firstSlash = unixPath.indexOf('/');
        if (firstSlash === -1) return true; // Нет слэшей (файл в корне)

        // Ищем второй слэш, начиная сразу после первого
        const secondSlash = unixPath.indexOf('/', firstSlash + 1);

        // Если второго слэша нет (-1), значит это файл первого уровня вложенности (Root/file.txt)
        return secondSlash === -1;
      })
      .map((f) => f.name);

    super(rootCandidates, options.presetOverride);

    const presetExtensions = CONTEXT_PRESETS[this.detectedPreset].textExtensions;
    const finalExtensions = [
      ...new Set([...presetExtensions, ...(options.customExtensions || [])]),
    ];

    this.ingest(files, finalExtensions);
  }

  private ingest(files: File[], textExtensions: string[]) {
    // Используем обычный цикл for для производительности на огромных массивах
    const now = Date.now();
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;

      const rawPath = file.webkitRelativePath || file.name;
      const normalizedPath = this.normalizePath(rawPath);

      // Кэшируем расширение
      const dotIndex = file.name.lastIndexOf('.');
      const ext = dotIndex !== -1 ? file.name.substring(dotIndex).toLowerCase() : '';

      this.nodes.set(normalizedPath, {
        id: `${now}-${i}`,
        path: normalizedPath,
        name: file.name,
        size: file.size,
        extension: ext,
        langTag: getLanguageTag(file.name),
        isText: isTextFile(file.name, textExtensions),
        file,
      });
    }
  }

  public getObjectUrl(path: string): string | null {
    const node = this.nodes.get(path);
    if (!node) return null;

    const existing = this.urls.get(path);
    if (existing) return existing;

    const newUrl = URL.createObjectURL(node.file);
    this.urls.set(path, newUrl);
    return newUrl;
  }

  public dispose() {
    for (const url of this.urls.values()) {
      URL.revokeObjectURL(url);
    }
    this.urls.clear();
    this.nodes.clear();
  }
}
