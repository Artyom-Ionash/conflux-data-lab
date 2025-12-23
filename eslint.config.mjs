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
  // 1. БАЗОВЫЕ ПРАВИЛА И ГРАНИЦЫ (Общие для всего проекта)
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
        // 1. ТЕСТЫ
        { type: 'test', pattern: ['**/*.test.ts', '**/*.test.tsx'], mode: 'file' },

        // 2. СТРУКТУРНЫЕ ЭЛЕМЕНТЫ
        {
          type: 'app-layer',
          pattern: 'app/(page|layout|loading|error|not-found|tools/**/page).tsx',
          mode: 'file',
        },
        { type: 'app-registry', pattern: 'app-registry/*', mode: 'folder' },
        { type: 'tool', pattern: 'view/tools/*.tsx', mode: 'file', capture: ['toolName'] },
        { type: 'entity', pattern: 'view/tools/*/*.tsx', mode: 'file', capture: ['entityName'] },
        { type: 'app-component', pattern: 'view/(catalog|shell)/*', mode: 'folder' },

        // 3. ПЕРИМЕТР UI
        { type: 'ui-infrastructure', pattern: 'view/ui/infrastructure/*', mode: 'folder' },
        {
          type: 'ui-component',
          pattern: 'view/ui/*.tsx',
          mode: 'file',
          capture: ['componentName'],
        },

        // 4. ЛОГИКА
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

      // --- BOUNDARIES (Архитектурные границы) ---
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              from: 'core',
              disallow: [
                'app-registry',
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
              disallow: [
                'app-registry',
                'ui-component',
                'ui-infrastructure',
                'entity',
                'tool',
                'app-layer',
              ],
              message: '❌ Modules must not depend on UI or App layers',
            },
            {
              from: 'ui-component',
              disallow: ['app-registry', 'core', 'module', 'entity', 'tool', 'app-layer'],
              message:
                '❌ UI Component must be a stand-alone crystal. Imports from /lib or /app are forbidden.',
            },
            {
              from: 'ui-component',
              disallow: [['ui-component', { componentName: '!${from.componentName}' }]],
              allow: ['ui-infrastructure'],
              message: '❌ UI Components cannot depend on each other. Use slots or infrastructure.',
            },
            {
              from: 'ui-infrastructure',
              disallow: [
                'app-registry',
                'ui-component',
                'core',
                'module',
                'entity',
                'tool',
                'app-layer',
              ],
              message: '❌ UI Infrastructure must be pure and depend only on third-party packages.',
            },
            {
              from: 'entity',
              disallow: ['app-registry', 'tool', 'app-layer'],
              message: '❌ Entities must not depend on specific Tools or Pages',
            },
            {
              from: 'tool',
              disallow: [['tool', { toolName: '!${from.toolName}' }], 'app-layer', 'app-registry'],
              message: '❌ Tools must be isolated from each other and the Registry/App Layer',
            },
            {
              from: 'app-registry',
              disallow: ['app-layer'],
              allow: ['tool', 'core', 'entity', 'ui-component', 'ui-infrastructure'],
              message: '❌ App Registry must not depend on the App Layer (Routing/Pages)',
            },
          ],
        },
      ],
    },
  },

  // ---------------------------------------------------------------------------
  // 2. ПОЛИТИКА ИМЕНОВАНИЯ (Naming Convention)
  // ---------------------------------------------------------------------------

  // A. ПО УМОЛЧАНИЮ: Kebab-Case
  // Применяется ко всем TS/JS файлам (утилиты, конфиги, хуки, типы)
  {
    files: ['**/*.{ts,tsx,mts,js,mjs}'],
    rules: {
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
          // Игнорируем файлы, начинающиеся с _, и специальные README/LICENSE
          ignore: [/^_/, /^README\.md$/, /^CONTRIBUTING\.md$/, /^ARCHITECTURE\.md$/],
        },
      ],
    },
  },

  // B. КОМПОНЕНТЫ: PascalCase
  // Применяется только к React-компонентам в слоях view и app/_ui
  {
    files: ['view/**/*.tsx', 'app/_ui/**/*.tsx'],
    rules: {
      'unicorn/filename-case': [
        'error',
        {
          case: 'pascalCase',
          ignore: [
            // Разрешаем файлы, начинающиеся с _ (например _graphics)
            /^_/,
            // Разрешаем аббревиатуру IO (SidebarIO, AudioIO)
            /IO\.tsx$/,
          ],
        },
      ],
    },
  },

  // C. ИСКЛЮЧЕНИЯ NEXT.JS: Kebab-Case
  // Возвращаем kebab-case для спецфайлов роутера, даже если они попали под правило B
  {
    files: [
      'app/**/page.tsx',
      'app/**/layout.tsx',
      'app/**/loading.tsx',
      'app/**/error.tsx',
      'app/**/not-found.tsx',
      'app/**/template.tsx',
      'app/**/default.tsx',
      'app/**/route.ts',
    ],
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

  eslintConfigPrettier,
]);

export default eslintConfig;