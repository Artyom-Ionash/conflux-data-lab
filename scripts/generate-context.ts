import { writeFileSync, readFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ignore from 'ignore'; // <--- НОВЫЙ ИМПОРТ

// SHARED IMPORTS
import {
  isTextFile,
  getLanguageTag,
  preprocessContent,
} from '../lib/modules/file-system/file-utils';
import { GodotSceneParser } from '../lib/modules/file-system/godot-scene';
import { generateAsciiTree } from '../lib/modules/file-system/tree-view';
import { CONTEXT_PRESETS } from '../lib/modules/context-generator/config';
import { generateContextOutput, ProcessedContextFile } from '../lib/modules/context-generator/core';

// --- CONFIG ---
const PRESET = CONTEXT_PRESETS.nextjs;
const OUTPUT_DIR = '.context';
const OUTPUT_FILENAME = 'project.txt';
const MAX_FILE_SIZE_KB = 500;

// Папки с точкой, которые мы разрешаем (игнор-менеджер их отфильтрует сам, если они в .gitignore)
// Но мы должны разрешить их "вход" в рекурсию.
const ALLOWED_DOT_DIRS = ['.husky', '.github', '.storybook'];

// --- UTILS ---

function getIgManager(rootDir: string) {
  const ig = ignore();

  // 1. Добавляем жесткие правила пресета
  ig.add(PRESET.hardIgnore);

  // 2. Читаем .gitignore, если есть
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

  // Инициализируем менеджер игнорирования
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
      // Относительный путь от корня проекта (важно для ignore)
      const relPath = relative(rootDir, fullPath);

      // 1. ПРОВЕРКА ЧЕРЕЗ ПАКЕТ IGNORE (Правильная!)
      // ig.ignores() принимает относительный путь (например 'src/utils/file.ts')
      // Для папок лучше добавлять слеш, но пакет умный, поймет и так.
      if (ig.ignores(relPath)) continue;

      if (entry.isDirectory()) {
        // 2. Логика скрытых папок (оптимизация обхода)
        // Если папка скрытая (начинается с точки) И она не в белом списке системных папок
        // мы в неё даже не заходим, чтобы не тратить время (например .git весит много)
        if (entry.name.startsWith('.') && !ALLOWED_DOT_DIRS.includes(entry.name)) {
          continue;
        }

        walkDirectory(fullPath, fileList, forTree, treeNodes);
      } else {
        // Логика сбора файлов
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

  // Сбор данных
  const allFilePaths: string[] = [];
  walkDirectory(rootDir, allFilePaths, false);

  const sceneParser = new GodotSceneParser();
  const processedFiles: ProcessedContextFile[] = [];

  // Обработка контента
  for (const filePath of allFilePaths) {
    try {
      if (statSync(filePath).size > MAX_FILE_SIZE_KB * 1024) continue;

      const originalText = readFileSync(filePath, 'utf-8');
      const filename = filePath.split(/[/\\]/).pop() || '';
      const relPath = relative(rootDir, filePath).replaceAll('\\', '/');
      const ext = filename.split('.').pop() || 'txt';

      let cleanedText = '';
      let langTag = getLanguageTag(filename);

      if (ext === 'tscn') {
        try {
          cleanedText = `; [Godot Scene Tree]...\n${sceneParser.parse(originalText)}`;
          langTag = 'text';
        } catch {
          cleanedText = preprocessContent(originalText, ext);
        }
      } else {
        cleanedText = preprocessContent(originalText, ext);
      }

      processedFiles.push({
        path: relPath,
        content: cleanedText,
        langTag,
        size: cleanedText.length,
      });
    } catch (e) {
      console.warn('Skip:', filePath);
    }
  }

  // Генерация дерева
  const treeNodes: any[] = [];
  walkDirectory(rootDir, [], true, treeNodes);
  treeNodes.sort((a: any, b: any) => a.path.localeCompare(b.path));
  const treeString = generateAsciiTree(treeNodes);

  // Генерация XML
  const { output, stats } = generateContextOutput(processedFiles, treeString);
  writeFileSync(join(outputDirPath, OUTPUT_FILENAME), output);

  console.log(
    `✅ Updated context: ${stats.fileCount} files, ~${stats.totalTokens.toLocaleString()} tokens`
  );
} catch (err) {
  console.error('❌ Failed:', err);
}
