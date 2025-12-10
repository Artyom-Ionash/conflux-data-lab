#!/usr/bin/env node

import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path'; // Удален relative
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// LOAD CONFIGURATION
// =============================================================================

let config = null;
const configPath = join(__dirname, 'config.mjs');

if (existsSync(configPath)) {
  try {
    config = await import('./config.mjs');
    console.log('✅ Загружена кастомная конфигурация');
  } catch (error) {
    console.log('⚠️  Не удалось загрузить конфигурацию, использую базовые настройки');
    console.log('   ', error.message);
  }
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

const DEFAULT_IGNORE_PATTERNS = [
  'node_modules', '.next', '.git', 'out', 'build', '.vercel',
  'coverage', '.pnp', '.yarn', 'dist', '*.log', '.DS_Store', '*.tsbuildinfo',
];

const DEFAULT_PRIORITY_DIRS = ['app', 'lib', 'public'];
const DEFAULT_PRIORITY_FILES = [
  'README.md', 'ARCHITECTURE.md', 'STRUCTURE.md', 'package.json',
  'tsconfig.json', 'next.config.ts',
];

const DEFAULT_DESCRIPTIONS = {
  app: 'Next.js App Router',
  'app/components': 'React компоненты',
  'app/components/layout': 'Компоненты макета',
  'app/components/tools': 'Компоненты инструментов',
  'app/components/ui': 'UI компоненты',
  'app/components/domain': 'Доменные компоненты',
  'app/tools': 'Маршруты инструментов',
  'app/tools/[category]': 'Динамический маршрут категории',
  'app/tools/[category]/[toolId]': 'Динамический маршрут инструмента',
  lib: 'Библиотека и утилиты',
  'lib/config': 'Конфигурационные файлы',
  'lib/types': 'TypeScript типы',
  'lib/utils': 'Утилитарные функции',
  'lib/domain': 'Доменная логика',
  public: 'Статические файлы',
  'app/layout.tsx': 'Корневой layout',
  'app/page.tsx': 'Главная страница',
  'app/globals.css': 'Глобальные стили',
  'lib/config/tools.ts': 'Конфигурация всех инструментов',
  'lib/types/tools.ts': 'TypeScript типы',
  'lib/utils/tool-loader.tsx': 'Загрузчик компонентов',
  'ARCHITECTURE.md': 'Описание архитектуры',
  'README.md': 'Основная документация',
  'STRUCTURE.md': 'Этот файл (автогенерируется)',
};

// Use config or defaults
const IGNORE_PATTERNS = config?.IGNORE_PATTERNS || DEFAULT_IGNORE_PATTERNS;
const PRIORITY_DIRS = config?.PRIORITY_DIRS || DEFAULT_PRIORITY_DIRS;
const PRIORITY_FILES = config?.PRIORITY_FILES || DEFAULT_PRIORITY_FILES;
const DESCRIPTIONS = config?.DESCRIPTIONS || DEFAULT_DESCRIPTIONS;

const formatName = config?.formatName || ((name, relativePath, isDir) => isDir ? `${name}/` : name);
const shouldShow = config?.shouldShow || (() => true);

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function shouldIgnore(path, name) {
  return IGNORE_PATTERNS.some((pattern) => {
    if (pattern.startsWith('!')) {
      return false; // Skip negation patterns for now
    }
    if (pattern.includes('*')) {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\./g, '\\.') + '$'
      );
      return regex.test(name);
    }
    return name === pattern || path.includes(`/${pattern}/`);
  });
}

// Удален неиспользуемый аргумент basePath
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

// Удален неиспользуемый аргумент isLast
function buildTree(dirPath, basePath = '', prefix = '') {
  const entries = readdirSync(dirPath)
    .map((name) => {
      const fullPath = join(dirPath, name);
      if (shouldIgnore(fullPath, name)) return null;

      try {
        const stat = statSync(fullPath);
        const isDirectory = stat.isDirectory();
        const relativePath = join(basePath, name);

        // Check custom filter
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

  const sorted = sortEntries(entries); // Убран второй аргумент
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
      // Убран четвертый аргумент isLastEntry
      result += buildTree(entry.fullPath, entry.relativePath, newPrefix);
    } else {
      result += `${prefix}${connector}${displayName}${comment}\n`;
    }
  });

  return result;
}

// =============================================================================
// MARKDOWN GENERATION
// =============================================================================

function generateStructureMd(tree) {
  // Use custom template if available
  if (config?.generateTemplate) {
    return config.generateTemplate(tree);
  }

  // Default template
  return `# Структура проекта Conflux Data Lab

Этот файл описывает **фактическую структуру файлов** проекта. Архитектурные принципы см. в \`ARCHITECTURE.md\`, общий обзор — в \`README.md\`.

> ⚠️ **Этот файл генерируется автоматически при коммите.** Не редактируйте вручную!

\`\`\`
conflux-data-lab/
│
${tree}\`\`\`

## Ключевые особенности структуры

### 1. Модульность
- Каждый инструмент - независимый компонент
- Легко добавлять/удалять инструменты
- Переиспользуемые UI компоненты

### 2. Типобезопасность
- Все типы определены в \`lib/types/\`
- TypeScript проверяет корректность на этапе компиляции

### 3. Масштабируемость
- Новые инструменты добавляются в 3 шага:
  1. Конфигурация в \`lib/config/tools.ts\`
  2. Компонент в \`app/components/tools/[tool-id]/\`
  3. Регистрация в \`lib/utils/tool-loader.tsx\`

### 4. Организация по категориям
- Инструменты группируются по категориям
- URL структура: \`/tools/[category]/[toolId]\`
- Легкая навигация и фильтрация

## Примеры маршрутов

- \`/\` - Главная страница со всеми инструментами
- \`/tools/conversion\` - Все инструменты конвертации
- \`/tools/conversion/json-to-csv\` - Конкретный инструмент

## Следующие шаги

1. Добавьте больше инструментов в \`lib/config/tools.ts\`
2. Создайте компоненты для каждого инструмента
3. Зарегистрируйте компоненты в \`lib/utils/tool-loader.tsx\`
4. Настройте стили под ваш бренд
`;
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
    const newContent = generateStructureMd(tree);

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