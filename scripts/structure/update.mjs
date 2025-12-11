import { execSync } from 'child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Импортируем конфигурацию как обязательную зависимость
import {
  DESCRIPTIONS,
  formatName,
  generateTemplate,
  IGNORE_PATTERNS,
  PRIORITY_DIRS,
  PRIORITY_FILES,
  shouldShow,
} from './config.mjs';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function shouldIgnore(path, name) {
  return IGNORE_PATTERNS.some((pattern) => {
    if (pattern.startsWith('!')) {
      return false; // Skip negation patterns for now
    }
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$');
      return regex.test(name);
    }
    return name === pattern || path.includes(`/${pattern}/`);
  });
}

function sortEntries(entries) {
  return entries.sort((a, b) => {
    // Priority directories first
    const aPriorityDir = PRIORITY_DIRS.indexOf(a.name);
    const bPriorityDir = PRIORITY_DIRS.indexOf(b.name);
    if (aPriorityDir !== -1 && bPriorityDir !== -1) {
      return aPriorityDir - bPriorityDir;
    }
    if (aPriorityDir !== -1) return -1;
    if (bPriorityDir !== -1) return 1;

    // Priority files
    const aPriorityFile = PRIORITY_FILES.indexOf(a.name);
    const bPriorityFile = PRIORITY_FILES.indexOf(b.name);
    if (aPriorityFile !== -1 && bPriorityFile !== -1) {
      return aPriorityFile - bPriorityFile;
    }
    if (aPriorityFile !== -1) return -1;
    if (bPriorityFile !== -1) return 1;

    // Directories before files
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;

    // Alphabetical
    return a.name.localeCompare(b.name);
  });
}

function getDescription(relativePath) {
  return DESCRIPTIONS[relativePath] || '';
}

// =============================================================================
// TREE GENERATION
// =============================================================================

function buildTree(dirPath, basePath = '', prefix = '') {
  const entries = readdirSync(dirPath)
    .map((name) => {
      const fullPath = join(dirPath, name);
      if (shouldIgnore(fullPath, name)) return null;

      try {
        const stat = statSync(fullPath);
        const isDirectory = stat.isDirectory();
        const relativePath = join(basePath, name);

        // Check custom filter from config
        if (!shouldShow(name, fullPath, relativePath)) return null;

        return {
          name,
          isDirectory,
          fullPath,
          relativePath,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  const sorted = sortEntries(entries);
  let result = '';

  sorted.forEach((entry, index) => {
    const isLastEntry = index === sorted.length - 1;
    const connector = isLastEntry ? '└── ' : '├── ';
    const extension = isLastEntry ? '    ' : '│   ';
    const newPrefix = prefix + extension;

    const description = getDescription(entry.relativePath);
    const comment = description ? ` # ${description}` : '';
    const displayName = formatName(entry.name, entry.relativePath, entry.isDirectory);

    if (entry.isDirectory) {
      result += `${prefix}${connector}${displayName}${comment}\n`;
      result += buildTree(entry.fullPath, entry.relativePath, newPrefix);
    } else {
      result += `${prefix}${connector}${displayName}${comment}\n`;
    }
  });

  return result;
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

function main() {
  try {
    const rootDir = process.cwd();
    const structureFile = join(rootDir, 'STRUCTURE.md');

    console.log('🔍 Сканирование структуры проекта...');
    const tree = buildTree(rootDir);

    console.log('📝 Генерация STRUCTURE.md...');
    // Используем функцию генерации шаблона из конфига
    const newContent = generateTemplate(tree);

    // Check if content changed
    let oldContent = '';
    try {
      oldContent = readFileSync(structureFile, 'utf-8');
    } catch {
      console.log('⚠️  STRUCTURE.md не найден, создаю новый...');
    }

    if (oldContent === newContent) {
      console.log('✅ STRUCTURE.md актуален, изменений не требуется');
      process.exit(0);
    }

    writeFileSync(structureFile, newContent, 'utf-8');
    console.log('✅ STRUCTURE.md обновлен');

    // Add to git staging if running in git context
    try {
      execSync('git add STRUCTURE.md', { stdio: 'ignore' });
      console.log('✅ STRUCTURE.md добавлен в staging area');
    } catch {
      console.log('⚠️  Не удалось добавить в git (возможно, не в git-репозитории)');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
