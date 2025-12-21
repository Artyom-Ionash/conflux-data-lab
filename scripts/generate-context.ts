import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

import { runContextPipeline } from '@/lib/modules/context-generator/engine';
import { CONTEXT_PRESETS, LOCAL_CONTEXT_FOLDER } from '@/lib/modules/context-generator/rules';
import { isTextFile } from '@/lib/modules/file-system/analyzers';
import { createIgnoreManager } from '@/lib/modules/file-system/scanner';
import { type FileNode } from '@/lib/modules/file-system/topology';

// --- CONFIG ---
const PRESET = CONTEXT_PRESETS.nextjs;
const OUTPUT_DIR = '.context';
const OUTPUT_FILENAME = 'project.txt';
const MAX_FILE_SIZE_KB = 500;
const ALLOWED_DOT_DIRS = ['.husky', '.github', '.storybook', LOCAL_CONTEXT_FOLDER];

// --- GIT DELTA UTILS ---
function getGitBlobSize(filePath: string): number {
  try {
    const output = execSync(`git ls-tree -l HEAD "${filePath.replaceAll('\\', '/')}"`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const match = output.trim().split(/\s+/);
    const sizeColumn = match[3];
    if (match.length >= 4 && sizeColumn && sizeColumn !== '-') {
      return Number.parseInt(sizeColumn, 10);
    }
  } catch {
    return 0;
  }
  return 0;
}

function calculateGitDelta(rootDir: string): string {
  try {
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' });
    const lines = statusOutput.split('\n').filter((l) => l.trim());
    let totalDelta = 0;
    let changedFilesCount = 0;

    for (const line of lines) {
      const status = line.substring(0, 2);
      const filePath = line.substring(3).trim();
      const fullPath = join(rootDir, filePath);

      if (status.includes('D')) {
        totalDelta -= getGitBlobSize(filePath);
        changedFilesCount++;
        continue;
      }

      if (existsSync(fullPath)) {
        const currentSize = statSync(fullPath).size;
        const oldSize = getGitBlobSize(filePath);
        totalDelta += currentSize - oldSize;
        changedFilesCount++;
      }
    }

    if (changedFilesCount === 0) return '';
    const sign = totalDelta > 0 ? '+' : '';
    const color = totalDelta > 0 ? '\x1b[31m' : '\x1b[32m';
    const reset = '\x1b[0m';
    return ` | Pending Commit: ${color}${sign}${totalDelta} B${reset}`;
  } catch {
    return '';
  }
}

// --- MAIN RUNNER ---
async function main() {
  try {
    const rootDir = process.cwd();
    const outputDirPath = join(rootDir, OUTPUT_DIR);

    if (!existsSync(outputDirPath)) mkdirSync(outputDirPath);

    const gitIgnorePath = join(rootDir, '.gitignore');
    const gitIgnoreContent = existsSync(gitIgnorePath)
      ? readFileSync(gitIgnorePath, 'utf-8')
      : null;

    const ig = createIgnoreManager({
      gitIgnoreContent,
      ignorePatterns: PRESET.hardIgnore,
    });

    const sources: { path: string; name: string; content: string }[] = [];
    const treeNodes: FileNode[] = [];

    function walk(dir: string) {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relPath = relative(rootDir, fullPath).replaceAll('\\', '/');

        if (ig.ignores(relPath)) continue;

        if (entry.isDirectory()) {
          if (entry.name.startsWith('.') && !ALLOWED_DOT_DIRS.includes(entry.name)) continue;
          walk(fullPath);
        } else {
          const size = statSync(fullPath).size;
          const isText = isTextFile(entry.name, PRESET.textExtensions);
          const isLocalAI = relPath.startsWith(LOCAL_CONTEXT_FOLDER + '/');

          // Собираем данные для дерева
          treeNodes.push({ path: relPath, name: entry.name, size, isText });

          // Собираем контент для контекста
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

    // Используем общий Engine
    const { output, stats } = await runContextPipeline(sources, { includeTree: true });

    writeFileSync(join(outputDirPath, OUTPUT_FILENAME), output);

    const gitDeltaStr = calculateGitDelta(rootDir);
    console.log(
      `✅ Context: ${stats.fileCount} files, ~${stats.totalTokens.toLocaleString()} tokens${gitDeltaStr}`
    );
  } catch (err) {
    console.error('❌ Failed:', err);
    process.exit(1);
  }
}

// Запуск
void main();
