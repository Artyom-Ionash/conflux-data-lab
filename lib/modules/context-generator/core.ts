// lib/modules/context-generator/core.ts
import { formatBytes } from '@/lib/modules/file-system/topology';

import { calculateFileScore } from './_assembly';

export interface ProcessedContextFile {
  path: string;
  content: string;
  langTag: string;
  size: number;
  originalSize: number;
}

export interface ContextStats {
  totalTokens: number;
  fileCount: number;
  originalSizeBytes: number;
  cleanedSizeBytes: number;
  savingsPercentage: number;
  topLanguages: string;
  topHeavyFiles: { path: string; size: string; tokens: number }[];
}

export interface ContextGenerationResult {
  output: string;
  stats: ContextStats;
}

export function generateContextOutput(
  files: ProcessedContextFile[],
  treeString: string
): ContextGenerationResult {
  // 1. Сортировка
  const sortedFiles = [...files].sort((a, b) => {
    const scoreA = calculateFileScore(a.path.split('/').pop() || '', undefined, a.path);
    const scoreB = calculateFileScore(b.path.split('/').pop() || '', undefined, b.path);
    return scoreA !== scoreB ? scoreA - scoreB : a.path.localeCompare(b.path);
  });

  // 2. Метрики
  let totalTokens = 0;
  let originalSizeBytes = 0;
  let cleanedSizeBytes = 0;
  const composition: Record<string, number> = {};

  sortedFiles.forEach((f) => {
    totalTokens += Math.ceil(f.content.length / 4);
    originalSizeBytes += f.originalSize;
    cleanedSizeBytes += f.size;
    const lang = f.langTag === 'tsx' || f.langTag === 'ts' ? 'typescript' : f.langTag;
    composition[lang] = (composition[lang] || 0) + 1;
  });

  const topLanguages = Object.entries(composition)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([lang, count]) => `${lang} (${count})`)
    .join(', ');

  const topHeavyFiles = sortedFiles
    .sort((a, b) => b.size - a.size)
    .slice(0, 5)
    .map((f) => ({
      path: f.path,
      size: formatBytes(f.size),
      tokens: Math.ceil(f.size / 4),
    }));

  const savingsPercentage =
    originalSizeBytes > 0 ? ((originalSizeBytes - cleanedSizeBytes) / originalSizeBytes) * 100 : 0;

  // 3. Генерация (инкапсулируем XML-структуру)
  let output = `<codebase_context>
<instruction>
The following is a flattened representation of a project codebase.
1. Use the <directory_structure> to understand the file hierarchy.
2. Content is in <source_files>, where each file is wrapped in a <file> tag.
3. Code blocks utilize standard Markdown triple backticks with language tags.
4. METRICS: Approximately ${totalTokens.toLocaleString()} tokens across ${sortedFiles.length} files.
</instruction>

<project_metrics>
  <token_count_estimate>${totalTokens}</token_count_estimate>
  <file_count>${sortedFiles.length}</file_count>
  <top_languages>${topLanguages}</top_languages>
  <compression_ratio>${savingsPercentage.toFixed(1)}%</compression_ratio>
</project_metrics>

<directory_structure>
\`\`\`text
${treeString}
\`\`\`
</directory_structure>

<source_files>`;

  sortedFiles.forEach((file) => {
    output += `\n\n<file path="${file.path}">\n\`\`\`${file.langTag}\n${file.content}\n\`\`\`\n</file>`;
  });

  output += `\n</source_files>\n</codebase_context>`;

  return {
    output,
    stats: {
      totalTokens,
      fileCount: sortedFiles.length,
      topLanguages,
      originalSizeBytes,
      cleanedSizeBytes,
      savingsPercentage,
      topHeavyFiles,
    },
  };
}
