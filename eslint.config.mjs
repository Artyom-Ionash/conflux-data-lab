
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

  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'scripts/**']),

  // ---------------------------------------------------------------------------
  // 1. ГЛОБАЛЬНЫЕ ПРАВИЛА И ГРАНИЦЫ
  // ---------------------------------------------------------------------------
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      boundaries: boundaries,
      unicorn: eslintPluginUnicorn,
    },
    settings: {
      'boundaries/include': ['app/**/*', 'lib/**/*', 'view/**/*', 'app-registry/**/*'],
      'boundaries/elements': [
        { type: 'test', pattern: ['**/*.test.ts', '**/*.test.tsx'], mode: 'file' },
        {
          type: 'app-layer',
          pattern: 'app/(page|layout|loading|error|not-found|tools/**/page).tsx',
          mode: 'file',
        },
        { type: 'app-registry', pattern: 'app-registry/*', mode: 'folder' },
        { type: 'tool', pattern: 'view/tools/*.tsx', mode: 'file', capture: ['toolName'] },
        { type: 'entity', pattern: 'view/tools/*/*.tsx', mode: 'file', capture: ['entityName'] },
        { type: 'app-component', pattern: 'view/(catalog|shell)/*', mode: 'folder' },
        { type: 'ui-infrastructure', pattern: 'view/ui/_infrastructure/*', mode: 'folder' },
        { type: 'ui-component', pattern: 'view/ui/*.tsx', mode: 'file', capture: ['componentName'] },
        { type: 'module', pattern: 'lib/modules/*', mode: 'folder', capture: ['moduleName'] },
        { type: 'core', pattern: ['lib/core/*', 'lib/types/*'], mode: 'folder' },
      ],
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'unicorn/no-null': 'off',
      'react-hooks/exhaustive-deps': 'error',

      // --- 1. PACKAGE PRIVATE SCOPE (Стратегия 1) ---
      // Правило: Приватные папки (_) доступны только внутри их собственной директории.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            // A. Блокируем абсолютные пути к привату (@/...)
            // Это запрещает `import from '@/lib/modules/video/_sampler'`
            {
              group: ['@/**/_*'],
              message: '⛔ PRIVATE VIOLATION: Absolute imports of private folders are forbidden. Use the Public API of the module.',
            },
            // B. Блокируем выход к соседям (../)
            // Это запрещает `import from '../_infrastructure'` или `import from '../ToolB/_internal'`
            // Разрешены только импорты начинающиеся с `./` (текущая папка)
            {
              group: ['../*/_*', '../**/_*'],
              message: '⛔ SCOPE VIOLATION: You cannot reach into a sibling\'s or parent\'s private folder. Only direct children (./_folder) can be imported.',
            },
          ],
        },
      ],

      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: 'core',
              disallow: ['app-registry', 'module', 'ui-component', 'ui-infrastructure', 'entity', 'tool', 'app-layer'],
              message: '❌ Core must not depend on upper layers',
            },
            {
              from: 'module',
              disallow: ['app-registry', 'ui-component', 'ui-infrastructure', 'entity', 'tool', 'app-layer'],
              message: '❌ Modules must not depend on UI or App layers',
            },
            {
              from: 'ui-component',
              disallow: ['app-registry', 'core', 'module', 'entity', 'tool', 'app-layer'],
              message: '❌ UI Component must be a stand-alone crystal.',
            },
            {
              from: 'ui-component',
              disallow: [['ui-component', { componentName: '!${from.componentName}' }]],
              allow: ['ui-infrastructure'], 
              message: '❌ UI Components cannot depend on each other. Use slots or infrastructure.',
            },
            {
              from: 'ui-infrastructure',
              disallow: ['app-registry', 'ui-component', 'core', 'module', 'entity', 'tool', 'app-layer'],
              message: '❌ UI Infrastructure must be pure.',
            },
            {
              from: 'entity',
              disallow: ['app-registry', 'tool', 'app-layer'],
              message: '❌ Entities must not depend on specific Tools or Pages',
            },
            {
              from: 'tool',
              disallow: [['tool', { toolName: '!${from.toolName}' }], 'app-layer', 'app-registry'],
              message: '❌ Tools must be isolated from each other',
            },
            {
              from: 'app-registry',
              disallow: ['app-layer'],
              allow: ['tool', 'core', 'entity', 'ui-component', 'ui-infrastructure'],
              message: '❌ App Registry must not depend on the App Layer',
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // 2. ПОЛИТИКА ИМЕНОВАНИЯ (Naming Convention)
  // ---------------------------------------------------------------------------
  {
    files: ['**/*.{ts,tsx,mts,js,mjs}'],
    rules: {
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
          // Разрешаем underscore-префикс для структурных папок
          ignore: [/^_/, /^README\.md$/, /^CONTRIBUTING\.md$/, /^ARCHITECTURE\.md$/],
        },
      ],
    },
  },
  {
    files: ['view/**/*.tsx', 'app/ui/**/*.tsx'],
    rules: {
      'unicorn/filename-case': [
        'error',
        {
          case: 'pascalCase',
          // Разрешаем underscore и специальные файлы
          ignore: [/^_/, /IO\.tsx$/],
        },
      ],
    },
  },
  {
    // Спецфайлы Next.js всегда kebab-case
    files: ['app/**/page.tsx', 'app/**/layout.tsx', 'app/**/loading.tsx', 'app/**/error.tsx', 'app/**/not-found.tsx', 'app/**/template.tsx', 'app/**/default.tsx', 'app/**/route.ts'],
    rules: {
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    },
  },

  // ---------------------------------------------------------------------------
  // 3. СТРОГИЕ ПРАВИЛА TS
  // ---------------------------------------------------------------------------
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },

  eslintConfigPrettier,
]);

export default eslintConfig;