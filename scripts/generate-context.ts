import { writeFileSync, readFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';

// Импорт утилит
import {
  shouldIgnore,
  isTextFile,
  getLanguageTag,
  calculateFileScore,
} from '../lib/modules/file-system/file-utils';

// --- CONFIG ---

const OUTPUT_DIR = '.context'; // Имя папки
const OUTPUT_FILENAME = 'project.txt'; // Имя файла внутри
const MAX_FILE_SIZE_KB = 500;

const IGNORE_PATTERNS = [
  // Directories
  'node_modules',
  '.git',
  '.next',
  'out',
  'build',
  'dist',
  'coverage',
  '.vercel',
  '.idea',
  '.vscode',
  '.husky',
  '.context', // Игнорируем саму папку с контекстом при сканировании
  // Files
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  '.DS_Store',
  '*.tsbuildinfo',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.ico',
  '*.svg',
  '*.webp',
  '*.mp3',
  '*.mp4',
  '*.wav',
  '*.ogg',
  '*.webm',
  '*.zip',
  '*.tar',
  '*.gz',
  '*.pdf',
  '*.woff',
  '*.woff2',
  '*.ttf',
  '*.eot',
];

const TEXT_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.css',
  '.scss',
  '.html',
  '.gd',
  '.tscn',
  '.tres',
  '.yaml',
  '.yml',
  '.toml',
  '.gitignore',
  '.env.example',
  'dockerfile',
];

// --- HELPERS (Без изменений) ---

function generateTree(dir: string, prefix = ''): string {
  let output = '';
  const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    if (!a.isDirectory() && !b.isDirectory()) {
      const scoreA = calculateFileScore(a.name);
      const scoreB = calculateFileScore(b.name);
      if (scoreA !== scoreB) return scoreA - scoreB;
    }
    return a.name.localeCompare(b.name);
  });

  const filteredEntries = entries.filter((entry) => {
    if (shouldIgnore(entry.name, IGNORE_PATTERNS)) return false;
    if (entry.name.startsWith('.') && !['.gitignore', '.env.example'].includes(entry.name))
      return false;
    return true;
  });

  filteredEntries.forEach((entry, index) => {
    const isLast = index === filteredEntries.length - 1;
    const marker = isLast ? '└── ' : '├── ';

    let meta = '';
    if (!entry.isDirectory()) {
      try {
        const size = statSync(join(dir, entry.name)).size;
        meta = size < 1024 ? ` (${size}B)` : ` (${(size / 1024).toFixed(1)}KB)`;
      } catch (e) {}
    }

    output += `${prefix}${marker}${entry.name}${meta}\n`;

    if (entry.isDirectory()) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      output += generateTree(join(dir, entry.name), newPrefix);
    }
  });
  return output;
}

function collectFiles(dir: string, fileList: string[] = []) {
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const relPath = relative(process.cwd(), fullPath);

    if (shouldIgnore(relPath, IGNORE_PATTERNS)) continue;

    if (entry.isDirectory()) {
      if (entry.name.startsWith('.')) continue;
      collectFiles(fullPath, fileList);
    } else {
      if (isTextFile(entry.name, TEXT_EXTENSIONS)) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

// --- MAIN ---

try {
  const rootDir = process.cwd();
  const outputDirPath = join(rootDir, OUTPUT_DIR);
  const outputFilePath = join(outputDirPath, OUTPUT_FILENAME);

  // 1. Создаем папку .context, если её нет
  if (!existsSync(outputDirPath)) {
    mkdirSync(outputDirPath);
  }

  const allFiles = collectFiles(rootDir);

  let content = `<codebase_context>
<instruction>
The following is a representation of the project codebase.
1. Use <directory_structure> to understand hierarchy.
2. Content is in <source_files>.
</instruction>

<directory_structure>
\`\`\`text
${generateTree(rootDir)}
\`\`\`
</directory_structure>

<source_files>
`;

  let totalTokens = 0;
  let processedCount = 0;

  for (const filePath of allFiles) {
    try {
      const stats = statSync(filePath);
      if (stats.size > MAX_FILE_SIZE_KB * 1024) continue;

      const fileContent = readFileSync(filePath, 'utf-8');
      const relPath = relative(rootDir, filePath).replaceAll('\\', '/');
      const lang = getLanguageTag(filePath);

      totalTokens += Math.ceil(fileContent.length / 4);

      content += `
<file path="${relPath}">
\`\`\`${lang}
${fileContent}
\`\`\`
</file>
`;
      processedCount++;
    } catch (err) {
      // Silent error
    }
  }

  content += `
</source_files>

<metrics>
  <file_count>${processedCount}</file_count>
  <token_count_estimate>${totalTokens}</token_count_estimate>
</metrics>
</codebase_context>`;

  writeFileSync(outputFilePath, content);

  const timestamp = new Date().toLocaleTimeString('ru-RU');
  // Выводим путь относительно корня для краткости
  console.log(
    `✅ [${timestamp}] Updated ${OUTPUT_DIR}/${OUTPUT_FILENAME} (${processedCount} files, ~${totalTokens.toLocaleString()} tokens)`
  );
} catch (err) {
  console.error('❌ Context generation failed:', err);
}
