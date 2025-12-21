/**
 * Промышленный стандарт управления наборами файлов.
 * Реализует детекцию сигнатур проектов и ленивое управление Blob URL.
 */

import { CONTEXT_PRESETS, type PresetKey } from '../context-generator/rules';
import { getLanguageTag, isTextFile } from './analyzers';

export interface BundleNode {
  readonly id: string;
  readonly path: string; // Нормализованный Unix-style путь
  readonly name: string;
  readonly size: number;
  readonly extension: string;
  readonly langTag: string;
  readonly isText: boolean;
  readonly file: File;
}

interface BundleOptions {
  customExtensions?: string[];
  presetOverride?: PresetKey;
}

export class FileBundle {
  private readonly nodes: Map<string, BundleNode> = new Map();
  private readonly urls: Map<string, string> = new Map();
  public readonly detectedPreset: PresetKey;

  constructor(files: File[], options: BundleOptions = {}) {
    // 1. Детекция "почерка" проекта
    this.detectedPreset = options.presetOverride || this.detectSignature(files);

    // 2. Слияние правил расширений
    const presetExtensions = CONTEXT_PRESETS[this.detectedPreset].textExtensions;
    const finalExtensions = [
      ...new Set([...presetExtensions, ...(options.customExtensions || [])]),
    ];

    this.ingest(files, finalExtensions);
  }

  private detectSignature(files: File[]): PresetKey {
    const names = new Set(files.map((f) => f.name));
    if (names.has('project.godot')) return 'godot';
    if (names.has('package.json')) return 'nextjs';
    return 'nextjs';
  }

  private ingest(files: File[], textExtensions: string[]) {
    files.forEach((file, index) => {
      const rawPath = file.webkitRelativePath || file.name;
      // Нормализация пути: замена слешей и удаление имени корневой папки
      const unixPath = rawPath.replaceAll('\\', '/');
      const parts = unixPath.split('/');
      const normalizedPath = parts.length > 1 ? parts.slice(1).join('/') : unixPath;

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

  /**
   * Ленивое создание Object URL. Экономит память при больших списках.
   * Хранит URL во внутренней карте, не мутируя BundleNode.
   */
  public getObjectUrl(path: string): string | null {
    if (!this.nodes.has(path)) return null;

    const existing = this.urls.get(path);
    if (existing) return existing;

    const node = this.nodes.get(path);
    if (!node) return null;

    const newUrl = URL.createObjectURL(node.file);
    this.urls.set(path, newUrl);
    return newUrl;
  }

  public getItems(): BundleNode[] {
    return [...this.nodes.values()];
  }

  /**
   * Полная утилизация ресурсов.
   */
  public dispose() {
    for (const url of this.urls.values()) {
      URL.revokeObjectURL(url);
    }
    this.urls.clear();
    this.nodes.clear();
  }
}
