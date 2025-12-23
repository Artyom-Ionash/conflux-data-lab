import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import eslintConfigPrettier from 'eslint-config-prettier';
import boundaries from 'eslint-plugin-boundaries';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'scripts/**', '.ai/**']),

  // ---------------------------------------------------------------------------
  // 1. ГЛОБАЛЬНЫЕ НАСТРОЙКИ И ПЛАГИНЫ
  // ---------------------------------------------------------------------------
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      boundaries: boundaries,
      unicorn: eslintPluginUnicorn,
    },
    settings: {
      // Определяем, какие папки участвуют в проверке границ
      'boundaries/include': ['app/**/*', 'core/**/*', 'lib/**/*', 'view/**/*', 'app-registry/**/*'],
      
      'boundaries/elements': [
        // --- CORE KERNEL (Технологические Домены) ---
        { type: 'core-typescript', pattern: 'core/typescript/**/*', mode: 'folder' },
        // primitives: Чистые функции, константы, типы. 0 зависимостей.
        { type: 'core-primitives', pattern: 'core/primitives/*', mode: 'folder' },
        // browser: Web API (DOM, Canvas, LocalStorage).
        { type: 'core-browser', pattern: 'core/browser/*', mode: 'folder' },
        // react: Хуки, HOCи, Контексты.
        { type: 'core-react', pattern: 'core/react/*', mode: 'folder' },
        // tailwind: Утилиты стилизации.
        { type: 'core-tailwind', pattern: 'core/tailwind/*', mode: 'folder' },
        // node: Серверные утилиты (FS, Process).
        { type: 'core-node', pattern: 'core/node/*', mode: 'folder' },
        // next: Специфика фреймворка.
        { type: 'core-next', pattern: 'core/next/*', mode: 'folder' },

        // --- DOMAIN LOGIC (Business Rules) ---
        // module: Чистая бизнес-логика.
        { type: 'module', pattern: 'lib/modules/*', mode: 'folder', capture: ['moduleName'] },

        // --- VISUAL LAYER (Presentation) ---
        // ui-component: Глупые переиспользуемые компоненты.
        { type: 'ui-component', pattern: 'view/ui/**/*', mode: 'file' },
        // tool: Полноценные виджеты/страницы инструментов.
        { type: 'tool', pattern: 'view/tools/*.tsx', mode: 'file', capture: ['toolName'] },
        // entity: Подсистемы инструментов.
        { type: 'entity', pattern: 'view/tools/*/*.tsx', mode: 'file', capture: ['entityName'] },

        // --- APP LAYER (Routing & Assembly) ---
        { type: 'app-registry', pattern: 'app/registry/*', mode: 'folder' },
        { type: 'app-layer', pattern: 'app/**/*', mode: 'file' },
      ],
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'unicorn/no-null': 'off',
      'react-hooks/exhaustive-deps': 'error',

      // --- 2. ЗАЩИТА ПРИВАТНЫХ ОБЛАСТЕЙ (Package Private) ---
      // Запрещаем импорт из папок, начинающихся с `_` (кроме как из их родителя).
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Запрет абсолютных импортов привата (@/lib/modules/video/_sampler)
              group: ['@/**/_*'],
              message: '⛔ PRIVATE VIOLATION: Absolute imports of private folders are forbidden. Use the Public API.',
            },
            {
              // Запрет относительных импортов привата соседей (../_internal)
              group: ['../*/_*', '../**/_*'],
              message: '⛔ SCOPE VIOLATION: You cannot reach into a sibling\'s private folder.',
            },
          ],
        },
      ],

      // --- 3. АРХИТЕКТУРНЫЕ ГРАНИЦЫ (Access Control) ---
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            // ========================================================
            // A. CORE SECURITY (Защита Ядра)
            // ========================================================

            // 0. TYPESCRIPT (Global Access)
            // Типы не существуют в рантайме, поэтому они не нарушают границ.
            // Разрешаем доступ к ним для ВСЕХ слоев.
            {
              from: ['core-primitives', 'core-browser', 'core-react', 'core-node', 'core-next', 'core-tailwind', 'module', 'ui-component', 'entity', 'tool', 'app-layer', 'app-registry'],
              allow: ['core-typescript'],
            },
            // Сам TypeScript ни от кого не зависит (кроме, возможно, примитивов, если нужны const assertions)
            {
              from: 'core-typescript',
              disallow: ['core-browser', 'core-react', 'core-node', 'core-next', 'module', 'ui-component', 'tool', 'app-layer'],
              message: '❌ TypeScript utilities should be pure.',
            },
            
            // 1. Примитивы — это атомы. Они не зависят ни от чего.
            {
              from: 'core-primitives',
              disallow: ['core-react', 'core-browser', 'core-node', 'core-next', 'core-tailwind', 'module', 'ui-component', 'tool', 'app-layer'],
              message: '❌ Core Primitives must be pure JS/TS without dependencies.',
            },
            
            // 2. Клиентское ядро (Browser, React, Tailwind) не знает про Node.js.
            {
              from: ['core-browser', 'core-react', 'core-tailwind'],
              disallow: ['core-node', 'module', 'ui-component', 'tool'],
              message: '❌ Core utilities cannot depend on upper layers or Server-side code.',
            },
            
            // 3. Серверное ядро (Node) изолировано от Браузера и React.
            {
              from: 'core-node',
              disallow: ['core-browser', 'core-react', 'core-tailwind', 'core-next', 'ui-component'],
              message: '❌ Server-side Core cannot import Client-side code.',
            },

            // ========================================================
            // B. BUSINESS LOGIC (Чистая логика)
            // ========================================================

            // Модули должны быть агностичны к фреймворку (React, Next) и стилям (Tailwind).
            // Разрешено: primitives, browser (для Canvas/File API), node (если модуль серверный, но лучше разделять).
            // В данном конфиге мы пока разрешаем browser, так как у нас много графики.
            {
              from: 'module',
              disallow: ['core-react', 'core-tailwind', 'core-next', 'ui-component', 'tool', 'app-layer', 'app-registry'],
              message: '❌ Domain Modules must be framework-agnostic (No React, No Tailwind, No UI Components).',
            },

            // ========================================================
            // C. VISUAL LAYER (UI & Tools)
            // ========================================================

            // 1. UI Components — глупые кирпичики.
            // Могут использовать: React, Browser, Tailwind, Primitives.
            // ЗАПРЕЩЕНО: Node.js, Next.js, Тяжелые Модули, Другие UI (циклические).
            {
              from: 'ui-component',
              disallow: ['core-node', 'core-next', 'module', 'tool', 'app-layer', 'app-registry'],
              message: '❌ UI Library is strictly Client-Side. No Node.js, No Business Logic, No Next.js magic.',
            },
            {
              from: 'ui-component',
              disallow: [['ui-component', { componentName: '!${from.componentName}' }]],
              message: '❌ UI Components cannot depend on each other directly. Use slots or composition.',
            },

            // 2. Entities — умные части UI.
            {
              from: 'entity',
              disallow: ['core-node', 'tool', 'app-layer', 'app-registry'],
              message: '❌ Entities cannot use Node.js or depend on specific Tools.',
            },

            // 3. Tools — сборка фичи.
            // Это клиентский код (React). Ему ЗАПРЕЩЕН прямой доступ к Node.js.
            {
              from: 'tool',
              disallow: ['core-node', 'app-layer', ['tool', { toolName: '!${from.toolName}' }]],
              message: '❌ Tools cannot import Node.js directly or other Tools.',
            },

            // ========================================================
            // D. APP LAYER (Routing)
            // ========================================================
            
            {
              from: 'app-registry',
              disallow: ['app-layer', 'core-node'],
              message: '❌ Registry is a client-side map.',
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // 4. НАСТРОЙКИ ИМЕНОВАНИЯ ФАЙЛОВ
  // ---------------------------------------------------------------------------
  {
    files: ['**/*.{ts,tsx,mts,js,mjs}'],
    rules: {
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
          // Разрешаем:
          // 1. _underscore prefix (приватные папки)
          // 2. README/CONTRIBUTING/ARCHITECTURE (документация)
          // 3. Dockerfile (стандарт)
          ignore: [/^_/, /^README\.md$/, /^CONTRIBUTING\.md$/, /^ARCHITECTURE\.md$/, /^TECH_DEBT\.md$/, /^Dockerfile$/],
        },
      ],
    },
  },
  // Исключение для React компонентов: PascalCase
  {
    files: ['view/**/*.tsx', 'app/ui/**/*.tsx'],
    rules: {
      'unicorn/filename-case': [
        'error',
        {
          case: 'pascalCase',
          ignore: [/^_/, /IO\.tsx$/],
        },
      ],
    },
  },
  // Исключение для Next.js спецфайлов: kebab-case
  {
    files: ['app/**/page.tsx', 'app/**/layout.tsx', 'app/**/loading.tsx', 'app/**/error.tsx', 'app/**/not-found.tsx', 'app/**/template.tsx', 'app/**/default.tsx', 'app/**/route.ts'],
    rules: {
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    },
  },

  eslintConfigPrettier,
]);

export default eslintConfig;