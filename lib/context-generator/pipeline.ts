import { type FileNode, generateAsciiTree } from '@/lib/file-system/topology';

import { processFileToContext, type RawFile } from './_assembly';
import { type ContextGenerationResult, generateContextOutput } from './core';
import { type ContextPreset } from './rules';

export interface ContextFileSource {
  path: string;
  name: string;
  content: string;
}

/**
 * Универсальный конвейер сборки контекста.
 */
export async function runContextPipeline(
  sources: ContextFileSource[],
  options: {
    includeTree: boolean;
    // Для совместимости с exactOptionalPropertyTypes
    preset?: ContextPreset | undefined;
  }
): Promise<ContextGenerationResult> {
  const processedFiles = [];
  const treeNodes: FileNode[] = [];

  for (const source of sources) {
    const ext = source.name.split('.').pop() || 'txt';

    // 1. Проверяем политику "Tree Only" (Source of Truth)
    // Если путь начинается с одной из папок в treeOnly (например "addons/"), мы это запоминаем
    const activeTreeOnlyRule = options.preset?.treeOnly?.find((p) => source.path.startsWith(p));

    // 2. Подготовка для дерева (Всегда сохраняем оригинальный размер для метаданных)
    if (options.includeTree) {
      treeNodes.push({
        path: source.path,
        name: source.name,
        size: source.content.length,
        isText: true,
      });
    }

    // 3. Обработка контента:
    // Если файл попадает под правило treeOnly, мы ПРОПУСКАЕМ его добавление в processedFiles.
    // Он останется только в ASCII-дереве.
    if (activeTreeOnlyRule) {
      continue;
    }

    const raw: RawFile = {
      name: source.name,
      path: source.path,
      content: source.content,
      extension: ext,
    };

    const contextNode = processFileToContext(raw);

    processedFiles.push({
      path: contextNode.path,
      content: contextNode.content,
      langTag: contextNode.langTag,
      size: contextNode.cleanedSize,
      originalSize: contextNode.originalSize,
    });
  }

  const treeString = options.includeTree
    ? generateAsciiTree(treeNodes.sort((a, b) => a.path.localeCompare(b.path)))
    : '';

  return generateContextOutput(processedFiles, treeString);
}
