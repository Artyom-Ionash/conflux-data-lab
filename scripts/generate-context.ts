import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { walkSync } from '@/core/node/file-system';
import { calculateGitDelta } from '@/core/node/git';
import { runContextPipeline } from '@/lib/context-generator/engine';
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

  console.log(`🔎 Project detected as: ${preset.name}`);

  // 2. Настройка игнорирования
  const ig = createIgnoreManager({
    gitIgnoreContent: existsSync(join(rootDir, '.gitignore'))
      ? readFileSync(join(rootDir, '.gitignore'), 'utf-8')
      : null,
    ignorePatterns: preset.hardIgnore,
  });

  const sources: { path: string; name: string; content: string }[] = [];

  // 3. Обход файловой системы (используем генератор из core/node)
  for (const entry of walkSync(rootDir)) {
    // Фильтрация Dot-директорий на верхнем уровне
    if (entry.name.startsWith('.') && entry.isDirectory) {
      if (!ALLOWED_DOT_DIRS.includes(entry.name)) {
        // Мы не можем прервать рекурсию здесь через continue,
        // так как walkSync уже внутри.
        // Но walkSync поддерживает shouldIgnore, передадим логику туда?
        // Для простоты оставим проверку здесь, walkSync всё равно эффективен.
        continue;
      }
    }

    if (ig.ignores(entry.relPath)) continue;

    if (!entry.isDirectory) {
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
  }

  // 4. Генерация
  const { output, stats } = await runContextPipeline(sources, {
    includeTree: true,
    preset,
  });

  // 5. Запись результата
  if (!existsSync(join(rootDir, OUTPUT_DIR))) mkdirSync(join(rootDir, OUTPUT_DIR));
  writeFileSync(join(rootDir, OUTPUT_DIR, OUTPUT_FILENAME), output);

  console.log(
    `✅ Context: ${stats.fileCount} files, ~${stats.totalTokens.toLocaleString()} tokens${calculateGitDelta(rootDir)}`
  );
}

void main();
