import { type FileNode, generateAsciiTree } from '@/lib/modules/file-system/topology';

import { processFileToContext, type RawFile } from './assembly';
import {
  type ContextGenerationResult,
  generateContextOutput,
  type ProcessedContextFile,
} from './core';

export interface ContextFileSource {
  path: string;
  name: string;
  content: string;
}

/**
 * Универсальный конвейер сборки контекста.
 * Агностичен к среде (Node.js/Browser).
 */
export async function runContextPipeline(
  sources: ContextFileSource[],
  options: { includeTree: boolean }
): Promise<ContextGenerationResult> {
  const processedFiles: ProcessedContextFile[] = [];
  const treeNodes: FileNode[] = [];

  for (const source of sources) {
    const ext = source.name.split('.').pop() || 'txt';

    // 1. Подготовка для дерева
    if (options.includeTree) {
      treeNodes.push({
        path: source.path,
        name: source.name,
        size: source.content.length,
        isText: true, // Engine работает только с уже отфильтрованным текстом
      });
    }

    // 2. Трансформация контента
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
