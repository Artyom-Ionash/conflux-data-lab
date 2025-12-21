import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { runContextPipeline } from '@/lib/modules/context-generator/engine';
import { CONTEXT_PRESETS, LOCAL_CONTEXT_FOLDER } from '@/lib/modules/context-generator/rules';
import { isTextFile } from '@/lib/modules/file-system/analyzers';
import { createIgnoreManager } from '@/lib/modules/file-system/scanner';

// --- CONFIG ---
const OUTPUT_DIR = '.context';
const OUTPUT_FILENAME = 'project.txt';
const MAX_FILE_SIZE_KB = 500;
const ALLOWED_DOT_DIRS = ['.husky', '.github', '.storybook', LOCAL_CONTEXT_FOLDER];

// --- GIT UTILS (Остаются здесь, так как это CLI-специфика) ---
function getGitBlobSize(filePath: string): number {
  try {
    const output = execSync(`git ls-tree -l HEAD "${filePath.replaceAll('\\', '/')}"`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const match = output.trim().split(/\s+/);
    return match[3] && match[3] !== '-' ? Number.parseInt(match[3], 10) : 0;
  } catch {
    return 0;
  }
}

function calculateGitDelta(rootDir: string): string {
  try {
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' });
    const lines = statusOutput.split('\n').filter((l) => l.trim());
    let totalDelta = 0;
    if (lines.length === 0) return '';

    for (const line of lines) {
      const status = line.substring(0, 2);
      const filePath = line.substring(3).trim();
      const fullPath = join(rootDir, filePath);
      if (status.includes('D')) {
        totalDelta -= getGitBlobSize(filePath);
      } else if (existsSync(fullPath)) {
        totalDelta += statSync(fullPath).size - getGitBlobSize(filePath);
      }
    }
    const sign = totalDelta > 0 ? '+' : '';
    const color = totalDelta > 0 ? '\x1b[31m' : '\x1b[32m';
    return ` | Pending Commit: ${color}${sign}${totalDelta} B\x1b[0m`;
  } catch {
    return '';
  }
}

// --- MAIN RUNNER ---
async function main() {
  const rootDir = process.cwd();

  // 1. Предварительный обход для детекции пресета (Переиспользование идеи Bundle)
  const rootFiles = readdirSync(rootDir);
  const isGodot = rootFiles.includes('project.godot');
  const preset = isGodot ? CONTEXT_PRESETS.godot : CONTEXT_PRESETS.nextjs;

  console.log(`🔎 Project detected as: ${preset.name}`);

  const ig = createIgnoreManager({
    gitIgnoreContent: existsSync(join(rootDir, '.gitignore'))
      ? readFileSync(join(rootDir, '.gitignore'), 'utf-8')
      : null,
    ignorePatterns: preset.hardIgnore,
  });

  const sources: { path: string; name: string; content: string }[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(rootDir, fullPath).replaceAll('\\', '/');

      if (ig.ignores(relPath)) continue;

      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') && !ALLOWED_DOT_DIRS.includes(entry.name)) continue;
        walk(fullPath);
      } else {
        const size = statSync(fullPath).size;
        // Используем расширения из автоматически выбранного пресета!
        const isText = isTextFile(entry.name, preset.textExtensions);
        const isLocalAI = relPath.startsWith(LOCAL_CONTEXT_FOLDER + '/');

        if ((isText || isLocalAI) && size < MAX_FILE_SIZE_KB * 1024) {
          sources.push({
            path: relPath,
            name: entry.name,
            content: readFileSync(fullPath, 'utf-8'),
          });
        }
      }
    }
  }

  walk(rootDir);

  const { output, stats } = await runContextPipeline(sources, {
    includeTree: true,
    preset, // Передаем пресет для корректной обработки treeOnly
  });

  if (!existsSync(join(rootDir, OUTPUT_DIR))) mkdirSync(join(rootDir, OUTPUT_DIR));
  writeFileSync(join(rootDir, OUTPUT_DIR, OUTPUT_FILENAME), output);

  console.log(
    `✅ Context: ${stats.fileCount} files, ~${stats.totalTokens.toLocaleString()} tokens${calculateGitDelta(rootDir)}`
  );
}

void main();
