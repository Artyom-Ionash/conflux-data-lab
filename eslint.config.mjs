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

  // 1. БАЗОВЫЕ ПРАВИЛА И ГРАНИЦЫ
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      boundaries: boundaries,
      unicorn: eslintPluginUnicorn,
    },
    settings: {
      'boundaries/include': ['app/**/*', 'lib/**/*', 'view/**/*'],
      'boundaries/elements': [
        // [UPDATED] 1. ТЕСТЫ (Первый приоритет)
        // Выделяем тесты в отдельный слой, чтобы на них не действовали ограничения кода.
        // Так как это первое правило, *.test.tsx попадет сюда и не будет считаться ui-component.
        {
          type: 'test',
          pattern: ['**/*.test.ts', '**/*.test.tsx'],
          mode: 'file',
        },

        // 2. ОСТАЛЬНЫЕ ЭЛЕМЕНТЫ
        {
          type: 'app-layer',
          pattern: 'app/(page|layout|loading|error|not-found|tools/**/page).tsx',
          mode: 'file',
        },
        { type: 'tool', pattern: 'view/tools/*.tsx', mode: 'file', capture: ['toolName'] },
        { type: 'entity', pattern: 'view/tools/*/*.tsx', mode: 'file', capture: ['entityName'] },
        { type: 'app-component', pattern: 'view/(catalog|shell)/*', mode: 'folder' },

        // --- ПЕРИМЕТР UI ---
        {
          type: 'ui-infrastructure',
          pattern: 'view/ui/infrastructure/*',
          mode: 'folder',
        },
        {
          type: 'ui-component',
          pattern: 'view/ui/*.tsx',
          mode: 'file',
          capture: ['componentName'],
        },
        // --- --- --- --- ---

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
      'unicorn/filename-case': 'off',
      'react-hooks/exhaustive-deps': 'error',

      'boundaries/element-types': [
        'error',
        {
          default: 'allow', // По умолчанию разрешаем всё (в т.ч. тестам импортировать код)
          rules: [
            {
              from: 'core',
              disallow: [
                'module',
                'ui-component',
                'ui-infrastructure',
                'entity',
                'tool',
                'app-layer',
              ],
              message: '❌ Core must not depend on upper layers',
            },
            {
              from: 'module',
              disallow: ['ui-component', 'ui-infrastructure', 'entity', 'tool', 'app-layer'],
              message: '❌ Modules must not depend on UI or App layers',
            },

            // --- ПРАВИЛА ИЗОЛЯЦИИ UI ---
            {
              from: 'ui-component',
              disallow: ['core', 'module', 'entity', 'tool', 'app-layer'],
              message:
                '❌ UI Component must be a stand-alone crystal. Imports from /lib or /app are forbidden.',
            },
            {
              from: 'ui-component',
              // Запрещаем импорт других компонентов UI (каждый файл сам по себе)
              disallow: [['ui-component', { componentName: '!${from.componentName}' }]],
              // Но разрешаем импорт своей внутренней инфраструктуры
              allow: ['ui-infrastructure'],
              message: '❌ UI Components cannot depend on each other. Use slots or infrastructure.',
            },
            {
              from: 'ui-infrastructure',
              // Инфраструктура UI не может зависеть от логики проекта
              disallow: ['ui-component', 'core', 'module', 'entity', 'tool', 'app-layer'],
              message: '❌ UI Infrastructure must be pure and depend only on third-party packages.',
            },
            // --- --- --- --- --- ---

            {
              from: 'entity',
              disallow: ['tool', 'app-layer'],
              message: '❌ Entities must not depend on specific Tools or Pages',
            },
            {
              from: 'tool',
              disallow: [['tool', { toolName: '!${from.toolName}' }], 'app-layer'],
              message: '❌ Tools must be isolated from each other and the App Layer',
            },
          ],
        },
      ],
    },
  },

  // 2. СТРОГИЕ ПРАВИЛА TS
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },

  // 3. ОТКЛЮЧЕНИЕ КОНФЛИКТУЮЩИХ ПРАВИЛ
  eslintConfigPrettier,
]);

export default eslintConfig;