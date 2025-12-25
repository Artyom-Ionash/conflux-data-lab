import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { walkSync } from '@/core/node/file-system';
import { calculateGitDelta } from '@/core/node/git';
import { runContextPipeline } from '@/lib/context-generator/pipeline';
import { CONTEXT_PRESETS, LOCAL_CONTEXT_FOLDER } from '@/lib/context-generator/rules';
import { isTextFile } from '@/lib/file-system/analyzers';
import { createIgnoreManager } from '@/lib/file-system/ignore';

// --- CONFIG ---
const OUTPUT_DIR = '.context';
const OUTPUT_FILENAME = 'project.txt';
const MAX_FILE_SIZE_KB = 500;
const ALLOWED_DOT_DIRS = ['.husky', '.github', '.storybook', LOCAL_CONTEXT_FOLDER];

async function main() {
  const rootDir = process.cwd();

  // 1. Детекция пресета
  const rootFiles = readdirSync(rootDir);
  const isGodot = rootFiles.includes('project.godot');
  const preset = isGodot ? CONTEXT_PRESETS.godot : CONTEXT_PRESETS.nextjs;

  // eslint-disable-next-line no-console
  console.log(`🔎 Project detected as: ${preset.name}`);

  // 2. Настройка игнорирования (читаем .gitignore)
  const ig = createIgnoreManager({
    gitIgnoreContent: existsSync(join(rootDir, '.gitignore'))
      ? readFileSync(join(rootDir, '.gitignore'), 'utf-8')
      : null,
    ignorePatterns: preset.hardIgnore,
  });

  // 3. Предикат фильтрации для генератора
  // Это функция решает, нужно ли вообще смотреть на файл/папку
  const shouldIgnore = (relPath: string, isDirectory: boolean) => {
    const name = relPath.split('/').pop() || '';

    // A. Жесткий бан для .git (даже если он внутри разрешенной .ai)
    if (name === '.git') return true;

    // B. Проверка по правилам .gitignore
    if (ig.ignores(relPath)) return true;

    // C. Фильтрация скрытых папок (начинающихся с точки)
    // Разрешаем только те, что в белом списке (ALLOWED_DOT_DIRS)
    if (isDirectory && name.startsWith('.') && !ALLOWED_DOT_DIRS.includes(name)) {
      return true;
    }

    return false;
  };

  const sources: { path: string; name: string; content: string }[] = [];

  // 4. Обход файловой системы
  // Передаем shouldIgnore в walkSync, чтобы остановить рекурсию в ненужные папки
  for (const entry of walkSync(rootDir, rootDir, { shouldIgnore })) {
    if (entry.isDirectory) continue;

    const isLocalAI = entry.relPath.startsWith(LOCAL_CONTEXT_FOLDER + '/');
    const isText = isTextFile(entry.name, preset.textExtensions);
    const isSmallEnough = entry.stats.size < MAX_FILE_SIZE_KB * 1024;

    if ((isText || isLocalAI) && isSmallEnough) {
      sources.push({
        path: entry.relPath,
        name: entry.name,
        content: readFileSync(entry.path, 'utf-8'),
      });
    }
  }

  // 5. Генерация
  const { output, stats } = await runContextPipeline(sources, {
    includeTree: true,
    preset,
  });

  // 6. Запись результата
  if (!existsSync(join(rootDir, OUTPUT_DIR))) mkdirSync(join(rootDir, OUTPUT_DIR));
  writeFileSync(join(rootDir, OUTPUT_DIR, OUTPUT_FILENAME), output);
  // eslint-disable-next-line no-console
  console.log(
    `✅ Context: ${stats.fileCount} files, ~${stats.totalTokens.toLocaleString()} tokens${calculateGitDelta(rootDir)}`
  );
}

void main();
