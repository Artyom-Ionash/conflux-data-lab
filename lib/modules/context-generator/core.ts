import { calculateFileScore } from './pipeline'; // Обновленный импорт

export interface ProcessedContextFile {
  path: string; // Относительный путь (app/page.tsx)
  content: string; // Уже очищенный контент
  langTag: string; // Язык для markdown (typescript)
  size: number;
}

export interface ContextGenerationResult {
  output: string;
  stats: {
    totalTokens: number;
    fileCount: number;
    topLanguages: string;
  };
}

/**
 * Чистая функция для генерации итогового XML промпта.
 * Сортирует файлы по важности перед склейкой.
 */
export function generateContextOutput(
  files: ProcessedContextFile[],
  treeString: string
): ContextGenerationResult {
  // 1. Сортировка (Конфиги выше, код ниже)
  const sortedFiles = [...files].sort((a, b) => {
    const nameA = a.path.split('/').pop() || '';
    const nameB = b.path.split('/').pop() || '';
    // Сначала по Score (чем меньше score, тем выше файл)
    const scoreA = calculateFileScore(nameA);
    const scoreB = calculateFileScore(nameB);
    if (scoreA !== scoreB) return scoreA - scoreB;
    // Потом по алфавиту
    return a.path.localeCompare(b.path);
  });

  // 2. Подсчет метрик
  let totalTokens = 0;
  const composition: Record<string, number> = {};

  sortedFiles.forEach((f) => {
    totalTokens += Math.ceil(f.content.length / 4);

    // Упрощенная статистика языков
    const lang = f.langTag === 'tsx' || f.langTag === 'ts' ? 'typescript' : f.langTag;
    composition[lang] = (composition[lang] || 0) + 1;
  });

  const topLanguages = Object.entries(composition)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([lang, count]) => `${lang} (${count})`)
    .join(', ');

  // 3. Генерация строки
  let output = `<codebase_context>
<instruction>
The following is a flattened representation of a project codebase.
1. Use the <directory_structure> to understand the file hierarchy.
2. Content is in <source_files>, where each file is wrapped in a <file> tag.
3. Code blocks utilize standard Markdown triple backticks with language tags (e.g., \`\`\`python) for expert routing.
4. METRICS: Approximately ${totalTokens.toLocaleString()} tokens across ${sortedFiles.length} files.
</instruction>

<project_metrics>
  <token_count_estimate>${totalTokens}</token_count_estimate>
  <file_count>${sortedFiles.length}</file_count>
  <top_languages>
    ${topLanguages}
  </top_languages>
</project_metrics>

<directory_structure>
\`\`\`text
${treeString}
\`\`\`
</directory_structure>

<source_files>
`;

  sortedFiles.forEach((file) => {
    output += `
<file path="${file.path}">
\`\`\`${file.langTag}
${file.content}
\`\`\`
</file>
`;
  });

  output += `
</source_files>
</codebase_context>`;

  return {
    output,
    stats: { totalTokens, fileCount: sortedFiles.length, topLanguages },
  };
}
