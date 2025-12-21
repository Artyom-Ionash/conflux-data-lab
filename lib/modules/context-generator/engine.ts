import { type FileNode, generateAsciiTree } from '@/lib/modules/file-system/topology';

import { processFileToContext, type RawFile } from './assembly';
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

    // 3. Обработка контента: если файл в treeOnly, заменяем контент на заглушку
    const finalContent = activeTreeOnlyRule
      ? `[File content omitted: matches tree-only pattern "${activeTreeOnlyRule}"]`
      : source.content;

    const raw: RawFile = {
      name: source.name,
      path: source.path,
      content: finalContent,
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
