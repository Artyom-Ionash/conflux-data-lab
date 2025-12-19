import { writeFileSync, readFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';
import ignore from 'ignore';
import { FileNode } from '@/lib/modules/file-system/tree-view';
// SHARED IMPORTS
import { isTextFile } from '@/lib/modules/file-system/file-utils';
import { generateAsciiTree } from '@/lib/modules/file-system/tree-view';
import {
  CONTEXT_PRESETS,
  MANDATORY_REPO_FILES,
  LOCAL_CONTEXT_FOLDER,
} from '../lib/modules/context-generator/config';
import { generateContextOutput, ProcessedContextFile } from '@/lib/modules/context-generator/core';
import { processFileToContext, type RawFile } from '@/lib/modules/context-generator/pipeline';

// --- CONFIG ---
const PRESET = CONTEXT_PRESETS.nextjs;
const OUTPUT_DIR = '.context';
const OUTPUT_FILENAME = 'project.txt';
const MAX_FILE_SIZE_KB = 500;
// Разрешаем вход в служебные папки и локальный контекст
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
      return parseInt(sizeColumn, 10);
    }
  } catch (e) {
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
        const oldSize = getGitBlobSize(filePath);
        totalDelta -= oldSize;
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
  } catch (e) {
    return '';
  }
}

// --- UTILS ---

function getIgManager(rootDir: string) {
  const ig = ignore();

  // 1. Базовые правила
  ig.add(PRESET.hardIgnore);

  // 2. .gitignore
  const gitIgnorePath = join(rootDir, '.gitignore');
  if (existsSync(gitIgnorePath)) {
    try {
      const content = readFileSync(gitIgnorePath, 'utf-8');
      ig.add(content);
    } catch (e) {
      console.warn('⚠️ Could not read .gitignore:', e);
    }
  }

  // 3. ПРИНУДИТЕЛЬНОЕ ВКЛЮЧЕНИЕ (Un-ignore)
  // Снимаем игнор с обязательных файлов документации
  if (MANDATORY_REPO_FILES.length > 0) {
    ig.add(MANDATORY_REPO_FILES.map((f) => `!${f}`));
  }

  // Снимаем игнор с папки локального контекста и её содержимого
  ig.add(`!${LOCAL_CONTEXT_FOLDER}`);
  ig.add(`!${LOCAL_CONTEXT_FOLDER}/**`);

  return ig;
}

// --- MAIN ---
try {
  const rootDir = process.cwd();
  const outputDirPath = join(rootDir, OUTPUT_DIR);

  if (!existsSync(outputDirPath)) mkdirSync(outputDirPath);

  const ig = getIgManager(rootDir);

  function walkDirectory(
    dir: string,
    fileList: string[] = [],
    forTree = false,
    treeNodes: FileNode[] = []
  ) {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(rootDir, fullPath).replaceAll('\\', '/');

      // Проверка игнорирования.
      // Благодаря правилам '!', папка .ai вернет false (не игнорировать)
      if (ig.ignores(relPath)) continue;

      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') && !ALLOWED_DOT_DIRS.includes(entry.name)) {
          continue;
        }
        walkDirectory(fullPath, fileList, forTree, treeNodes);
      } else {
        if (forTree) {
          const size = statSync(fullPath).size;
          const isText = isTextFile(entry.name, PRESET.textExtensions);
          treeNodes.push({ path: relPath, name: entry.name, size, isText });
        }

        if (!forTree) {
          const isText = isTextFile(entry.name, PRESET.textExtensions);
          // Дополнительно разрешаем любые файлы внутри .ai/
          const isLocalContext = relPath.startsWith(LOCAL_CONTEXT_FOLDER + '/');

          if (isText || isLocalContext) {
            fileList.push(fullPath);
          }
        }
      }
    }
  }

  const allFilePaths: string[] = [];
  walkDirectory(rootDir, allFilePaths, false);

  const processedFiles: ProcessedContextFile[] = [];

  for (const filePath of allFilePaths) {
    try {
      if (statSync(filePath).size > MAX_FILE_SIZE_KB * 1024) continue;

      const originalText = readFileSync(filePath, 'utf-8');
      const filename = filePath.split(/[/\\]/).pop() || '';
      const relPath = relative(rootDir, filePath).replaceAll('\\', '/');
      const ext = filename.split('.').pop() || 'txt';

      const rawFile: RawFile = {
        name: filename,
        path: relPath,
        content: originalText,
        extension: ext,
      };

      const contextNode = processFileToContext(rawFile);

      processedFiles.push({
        path: contextNode.path,
        content: contextNode.content,
        langTag: contextNode.langTag,
        size: contextNode.cleanedSize,
      });
    } catch (e) {
      console.warn('Skip:', filePath);
    }
  }

  const treeNodes: any[] = [];
  walkDirectory(rootDir, [], true, treeNodes);
  treeNodes.sort((a: any, b: any) => a.path.localeCompare(b.path));
  const treeString = generateAsciiTree(treeNodes);

  const { output, stats } = generateContextOutput(processedFiles, treeString);
  writeFileSync(join(outputDirPath, OUTPUT_FILENAME), output);

  const gitDeltaStr = calculateGitDelta(rootDir);

  console.log(
    `✅ Context: ${stats.fileCount} files, ~${stats.totalTokens.toLocaleString()} tokens${gitDeltaStr}`
  );
} catch (err) {
  console.error('❌ Failed:', err);
}
