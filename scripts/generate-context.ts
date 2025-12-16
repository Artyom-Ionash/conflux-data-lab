import { writeFileSync, readFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';
import ignore from 'ignore';

// SHARED IMPORTS
import { isTextFile } from '../lib/modules/file-system/file-utils';
import { generateAsciiTree } from '../lib/modules/file-system/tree-view';
import { CONTEXT_PRESETS } from '../lib/modules/context-generator/config';
import { generateContextOutput, ProcessedContextFile } from '../lib/modules/context-generator/core';
import { processFileToContext, type RawFile } from '../lib/modules/context-generator/pipeline';

// --- CONFIG ---
const PRESET = CONTEXT_PRESETS.nextjs;
const OUTPUT_DIR = '.context';
const OUTPUT_FILENAME = 'project.txt';
const MAX_FILE_SIZE_KB = 500;
const ALLOWED_DOT_DIRS = ['.husky', '.github', '.storybook'];

// --- GIT DELTA UTILS (NEW) ---
function getGitBlobSize(filePath: string): number {
  try {
    // git ls-tree выводит: <mode> <type> <hash> <size> <path>
    // Флаг -l показывает размер блоба в байтах
    // Используем относительный путь для git
    const output = execSync(`git ls-tree -l HEAD "${filePath.replaceAll('\\', '/')}"`, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'], // Подавляем ошибки stderr
    });

    // Парсим 4-ю колонку (size)
    const match = output.trim().split(/\s+/);
    // FIX: Явно сохраняем в переменную для проверки типов (noUncheckedIndexedAccess)
    const sizeColumn = match[3];

    if (match.length >= 4 && sizeColumn && sizeColumn !== '-') {
      return parseInt(sizeColumn, 10);
    }
  } catch (e) {
    // Если ошибка (например, файл не в гите), возвращаем 0
    return 0;
  }
  return 0;
}

function calculateGitDelta(rootDir: string): string {
  try {
    // Получаем список измененных файлов
    const statusOutput = execSync('git status --porcelain', { encoding: 'utf-8' });
    const lines = statusOutput.split('\n').filter((l) => l.trim());

    let totalDelta = 0;
    let changedFilesCount = 0;

    for (const line of lines) {
      const status = line.substring(0, 2);
      const filePath = line.substring(3).trim();
      const fullPath = join(rootDir, filePath);

      // Пропускаем удаленные файлы для простоты
      if (status.includes('D')) {
        const oldSize = getGitBlobSize(filePath);
        totalDelta -= oldSize;
        changedFilesCount++;
        continue;
      }

      if (existsSync(fullPath)) {
        const currentSize = statSync(fullPath).size;
        const oldSize = getGitBlobSize(filePath);

        // Если файл новый (?? или A), oldSize будет 0
        totalDelta += currentSize - oldSize;
        changedFilesCount++;
      }
    }

    if (changedFilesCount === 0) return '';

    const sign = totalDelta > 0 ? '+' : '';
    // Красим вывод: Красный если выросло, Зеленый если уменьшилось
    const color = totalDelta > 0 ? '\x1b[31m' : '\x1b[32m';
    const reset = '\x1b[0m';

    return ` | Pending Commit: ${color}${sign}${totalDelta} B${reset}`;
  } catch (e) {
    return ''; // Если нет гита или ошибка
  }
}

// --- UTILS ---

function getIgManager(rootDir: string) {
  const ig = ignore();
  ig.add(PRESET.hardIgnore);
  const gitIgnorePath = join(rootDir, '.gitignore');
  if (existsSync(gitIgnorePath)) {
    try {
      const content = readFileSync(gitIgnorePath, 'utf-8');
      ig.add(content);
    } catch (e) {
      console.warn('⚠️ Could not read .gitignore:', e);
    }
  }
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
    treeNodes: any[] = []
  ) {
    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(rootDir, fullPath);

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
          treeNodes.push({ path: relPath.replaceAll('\\', '/'), name: entry.name, size, isText });
        }

        if (!forTree && isTextFile(entry.name, PRESET.textExtensions)) {
          fileList.push(fullPath);
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

  // --- ВЫЧИСЛЕНИЕ DELTA ---
  const gitDeltaStr = calculateGitDelta(rootDir);

  console.log(
    `✅ Context: ${stats.fileCount} files, ~${stats.totalTokens.toLocaleString()} tokens${gitDeltaStr}`
  );
} catch (err) {
  console.error('❌ Failed:', err);
}
