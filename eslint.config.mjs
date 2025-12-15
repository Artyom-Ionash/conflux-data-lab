// conflux-data-lab/eslint.config.mjs

import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';
// УДАЛЕНО: import tseslint ...

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'scripts/**']),

  // 1. БАЗОВЫЕ ПРАВИЛА (работают везде)
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      boundaries: boundaries,
      unicorn: eslintPluginUnicorn,
    },
    settings: {
      'boundaries/include': ['app/**/*', 'lib/**/*'],
      'boundaries/elements': [
        { type: 'app-layer', pattern: 'app/(page|layout|loading|error|not-found|tools/**/page).tsx', mode: 'file' },
        { type: 'tool', pattern: 'app/components/tools/*', capture: ['toolName'] },
        { type: 'entity', pattern: 'app/components/entities/*', capture: ['entityName'] },
        { type: 'primitives', pattern: 'app/components/primitives/*', mode: 'folder' },
        { type: 'module', pattern: 'lib/modules/*', mode: 'folder', capture: ['moduleName'] },
        { type: 'core', pattern: ['lib/core/*', 'lib/types/*'], mode: 'folder' },
      ],
    },
    rules: {
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'eqeqeq': ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'unicorn/no-null': 'off',
      'unicorn/filename-case': 'off',
      
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            { from: 'core', disallow: ['module', 'primitives', 'entity', 'tool', 'app-layer'], message: '❌ Core (lib/core, lib/types) must not depend on upper layers' },
            { from: 'module', disallow: ['primitives', 'entity', 'tool', 'app-layer'], message: '❌ Modules (lib/modules) must not depend on UI components' },
            { from: 'primitives', disallow: ['module', 'entity', 'tool', 'app-layer'], message: '❌ Primitives (UI) must not depend on Business Logic or Entities' },
            { from: 'entity', disallow: ['tool', 'app-layer'], message: '❌ Entities must not depend on specific Tools or Pages' },
            { from: 'tool', disallow: [['tool', { toolName: '!${from.toolName}' }], 'app-layer'], message: '❌ Tools must be isolated from each other and the App Layer' },
          ],
        },
      ],
    },
  },

  // 2. СТРОГИЕ ПРАВИЛА TS (Применяем ТОЛЬКО к TS файлам)
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
      '@typescript-eslint/no-non-null-assertion': 'warn', // По умолчанию предупреждаем
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },

  // 3. ИСКЛЮЧЕНИЯ ДЛЯ ГРАФИКИ (Разрешаем ! там, где это критично для производительности)
  {
    files: [
      'lib/modules/graphics/**/*.ts', 
      'app/components/entities/video/**/*.tsx',
      'app/components/tools/video-frame-extractor/**/*.tsx'
    ],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
]);

export default eslintConfig;