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

  // 1. БАЗОВЫЕ ПРАВИЛА
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      boundaries: boundaries,
      unicorn: eslintPluginUnicorn,
    },
    settings: {
      'boundaries/include': ['app/**/*', 'lib/**/*', 'view/**/*'],
      'boundaries/elements': [
        {
          type: 'app-layer',
          pattern: 'app/(page|layout|loading|error|not-found|tools/**/page).tsx',
          mode: 'file',
        },
        { type: 'tool', pattern: 'view/instruments/*.tsx', mode: 'file', capture: ['toolName'] },
        { type: 'entity', pattern: 'view/instruments/*/*.tsx', mode: 'file', capture: ['entityName'] },
        { type: 'app-component', pattern: 'view/(catalog|shell)/*', mode: 'folder' },
        { type: 'ui', pattern: 'view/ui/*', mode: 'folder' },
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
          default: 'allow',
          rules: [
            {
              from: 'core',
              disallow: ['module', 'ui', 'entity', 'tool', 'app-layer'],
              message: '❌ Core (lib/core, lib/types) must not depend on upper layers',
            },
            {
              from: 'module',
              disallow: ['ui', 'entity', 'tool', 'app-layer'],
              message: '❌ Modules (lib/modules) must not depend on UI components',
            },
            {
              from: 'ui',
              disallow: ['module', 'entity', 'tool', 'app-layer'],
              message: '❌ UI Library must not depend on Business Logic or Entities',
            },
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
      
      // SAFETY NET: Запрещаем non-null assertion (!) глобально.
      // Код должен быть безопасным по построению.
      '@typescript-eslint/no-non-null-assertion': 'error',
      
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },

  // 3. ОТКЛЮЧЕНИЕ КОНФЛИКТУЮЩИХ ПРАВИЛ
  eslintConfigPrettier,
]);

export default eslintConfig;