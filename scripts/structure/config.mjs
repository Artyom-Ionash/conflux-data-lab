/**
 * Расширенная конфигурация для генератора структуры проекта
 * Этот файл можно использовать для более тонкой настройки
 */

// =============================================================================
// IGNORE PATTERNS
// =============================================================================

export const IGNORE_PATTERNS = [
  // Dependencies
  'node_modules',
  '.pnp',
  '.pnp.*',
  '.yarn',

  // Build outputs
  '.next',
  'out',
  'build',
  'dist',

  // Git
  '.git',

  // Testing
  'coverage',
  '.nyc_output',

  // Environment
  '.env*',
  '!.env.example',

  // Logs
  '*.log',
  'npm-debug.log*',
  'yarn-debug.log*',
  'yarn-error.log*',
  '.pnpm-debug.log*',

  // OS
  '.DS_Store',
  'Thumbs.db',

  // IDE
  '.vscode',
  '.idea',
  '*.swp',
  '*.swo',

  // TypeScript
  '*.tsbuildinfo',

  // Vercel
  '.vercel',
];

// =============================================================================
// PRIORITY SORTING
// =============================================================================

// Директории, которые должны отображаться первыми (в указанном порядке)
export const PRIORITY_DIRS = [
  'app',
  'lib',
  'public',
  'components',
  'pages',
  'styles',
  'types',
  'utils',
  'hooks',
  'contexts',
  'config',
];

// Файлы, которые должны отображаться первыми (в указанном порядке)
export const PRIORITY_FILES = [
  'README.md',
  'ARCHITECTURE.md',
  'STRUCTURE.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'LICENSE.md',
  'package.json',
  'tsconfig.json',
  'next.config.ts',
  'next.config.js',
  'tailwind.config.ts',
  'tailwind.config.js',
  '.eslintrc.json',
  '.prettierrc',
];

// =============================================================================
// DESCRIPTIONS
// =============================================================================

export const DESCRIPTIONS = {
  // Root directories
  app: 'Next.js App Router',
  pages: 'Next.js Pages Router',
  public: 'Статические файлы',
  lib: 'Библиотека и утилиты',
  components: 'React компоненты',
  styles: 'Стили приложения',
  types: 'TypeScript типы',
  utils: 'Утилитарные функции',
  hooks: 'React хуки',
  contexts: 'React контексты',
  config: 'Конфигурационные файлы',

  // App structure
  'app/components': 'React компоненты',
  'app/components/layout': 'Компоненты макета',
  'app/components/tools': 'Компоненты инструментов',
  'app/components/ui': 'UI компоненты',
  'app/components/domain': 'Доменные компоненты',
  'app/tools': 'Маршруты инструментов',
  'app/tools/[category]': 'Динамический маршрут категории',
  'app/tools/[category]/[toolId]': 'Динамический маршрут инструмента',
  'app/api': 'API маршруты',
  'app/layout.tsx': 'Корневой layout',
  'app/page.tsx': 'Главная страница',
  'app/globals.css': 'Глобальные стили',
  'app/about': 'Страница "О проекте"',
  'app/about/page.tsx': 'Страница "О проекте"',

  // Lib structure
  'lib/config': 'Конфигурационные файлы',
  'lib/types': 'TypeScript типы',
  'lib/utils': 'Утилитарные функции',
  'lib/domain': 'Доменная логика',
  'lib/config/tools.ts': 'Конфигурация всех инструментов',
  'lib/types/tools.ts': 'TypeScript типы для инструментов',
  'lib/utils/tool-loader.tsx': 'Загрузчик компонентов',

  // Domain-specific
  'lib/domain/hardware': 'Логика работы с аппаратными стандартами',
  'lib/domain/video': 'Логика работы с видео',
  'app/components/domain/hardware': 'Компоненты для аппаратных стандартов',
  'app/components/domain/video': 'Компоненты для работы с видео',

  // Config files
  'package.json': 'Конфигурация npm',
  'tsconfig.json': 'Конфигурация TypeScript',
  'next.config.ts': 'Конфигурация Next.js',
  'tailwind.config.ts': 'Конфигурация Tailwind CSS',
  'postcss.config.mjs': 'Конфигурация PostCSS',
  'eslint.config.mjs': 'Конфигурация ESLint',

  // Documentation
  'README.md': 'Основная документация',
  'ARCHITECTURE.md': 'Описание архитектуры',
  'STRUCTURE.md': 'Структура файлов (автогенерируется)',
  'CHANGES_REVIEW.md': 'Обзор изменений',

  // Scripts
  scripts: 'Вспомогательные скрипты',
  'scripts/update-structure.mjs': 'Генератор STRUCTURE.md',
  'scripts/structure-config.mjs': 'Конфигурация генератора',

  // Husky
  '.husky': 'Git hooks',
  '.husky/pre-commit': 'Pre-commit хук',
};

// =============================================================================
// CUSTOM FORMATTERS
// =============================================================================

/**
 * Функция для кастомизации отображения имени файла/директории
 * @param {string} name - имя файла/директории
 * @param {string} _relativePath - относительный путь от корня (не используется)
 * @param {boolean} isDirectory - является ли директорией
 * @returns {string} - отформатированное имя
 */
 
export function formatName(name, _relativePath, isDirectory) {
  // Добавьте слэш к директориям
  if (isDirectory) {
    return `${name}/`;
  }

  // Подсветка важных конфигурационных файлов
  if (PRIORITY_FILES.includes(name)) {
    return name;
  }

  return name;
}

/**
 * Функция для определения, нужно ли отображать файл/директорию
 * @param {string} name - имя файла/директории
 * @returns {boolean} - true если нужно показать
 */
export function shouldShow(name) {
  // Скрыть hidden файлы (кроме важных)
  if (name.startsWith('.') && !PRIORITY_FILES.includes(name)) {
    return false;
  }

  // Показать все остальные
  return true;
}

// =============================================================================
// TEMPLATE
// =============================================================================

/**
 * Шаблон для генерации markdown-файла
 * @param {string} tree - сгенерированное дерево
 * @returns {string} - полное содержимое STRUCTURE.md
 */
export function generateTemplate(tree) {
  return `# Структура проекта Conflux Data Lab

Этот файл описывает **фактическую структуру файлов** проекта. Архитектурные принципы см. в \`ARCHITECTURE.md\`, общий обзор — в \`README.md\`.

> ⚠️ **Этот файл генерируется автоматически при коммите.** Не редактируйте вручную!
> 
> Для настройки генератора см. \`scripts/update-structure.mjs\` и \`scripts/structure-config.mjs\`

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