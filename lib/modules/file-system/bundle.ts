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

  constructor(fileNames: string[], presetOverride?: PresetKey) {
    this.detectedPreset = presetOverride || this.detectSignature(fileNames);
  }

  /**
   * Детекция "почерка" проекта по списку имен файлов.
   */
  protected detectSignature(names: string[] | Set<string>): PresetKey {
    const nameSet = Array.isArray(names) ? new Set(names) : names;
    if (nameSet.has('project.godot')) return 'godot';
    if (nameSet.has('package.json')) return 'nextjs';
    return 'nextjs';
  }

  /**
   * Универсальная нормализация пути.
   */
  protected normalizePath(rawPath: string): string {
    const unixPath = rawPath.replaceAll('\\', '/');
    const parts = unixPath.split('/');
    // Убираем имя корневой папки, если это путь из input.webkitdirectory
    return parts.length > 1 ? parts.slice(1).join('/') : unixPath;
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
 * Работает с объектами File и управляет Blob URL.
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
    super(
      files.map((f) => f.name),
      options.presetOverride
    );

    const presetExtensions = CONTEXT_PRESETS[this.detectedPreset].textExtensions;
    const finalExtensions = [
      ...new Set([...presetExtensions, ...(options.customExtensions || [])]),
    ];

    this.ingest(files, finalExtensions);
  }

  private ingest(files: File[], textExtensions: string[]) {
    files.forEach((file, index) => {
      const rawPath = file.webkitRelativePath || file.name;
      const normalizedPath = this.normalizePath(rawPath);
      const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;

      this.nodes.set(normalizedPath, {
        id: `${Date.now()}-${index}`,
        path: normalizedPath,
        name: file.name,
        size: file.size,
        extension: ext,
        langTag: getLanguageTag(file.name),
        isText: isTextFile(file.name, textExtensions),
        file,
      });
    });
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
