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

  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', '.ai/**']),

  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      boundaries: boundaries,
      unicorn: eslintPluginUnicorn,
    },
    settings: {
      // Расширяем область видимости, чтобы линтер видел всё дерево
      'boundaries/include': ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      
      'boundaries/elements': [
        // --- 1. CORE KERNEL ---
        { type: 'typescript', pattern: 'core/typescript/**', mode: 'file' },
        { type: 'primitive', pattern: 'core/primitives/**', mode: 'file' },
        { type: 'browser', pattern: 'core/browser/**', mode: 'file' },
        { type: 'react', pattern: 'core/react/**', mode: 'file' },
        { type: 'tailwind', pattern: 'core/tailwind/**', mode: 'file' },
        { type: 'next', pattern: 'core/next/**', mode: 'file' },
        { type: 'node', pattern: 'core/node/**', mode: 'file' },

        // --- 2. BUSINESS LOGIC ---
        { type: 'library', pattern: 'lib/**', mode: 'file' },
        { type: 'script', pattern: 'scripts/**', mode: 'file' },

        // --- 3. VIEW LAYER ---
        { type: 'ui', pattern: 'view/ui/**', mode: 'file' },
        
        // --- 4. ROUTER LAYER ---
        { type: 'registry', pattern: 'app/registry/tool-loader.tsx', mode: 'file' },
        { type: 'router', pattern: 'app/**', mode: 'file' },
        
        // --- 5. SYNTHESIS LAYER ---
        { type: 'tool', pattern: 'view/tools/*', mode: 'file' },
        { type: 'tool-subsystem', pattern: 'view/tools/**/*', mode: 'file' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          message: '❌ ESLint разрешает только зависимости из "белого списка".',
          rules: [
            { // 1. ОБЩЕЕ
              from: '*', 
              allow: 'primitive'
            },
            { // 2. REACT
              from: 'react',
              allow:  'browser',
            },
            { // 3. Бизнес-логика (стремится к Framework-agnostic)
              from: 'library',
              allow: 'browser',
            },
            { // 4. Собирает простые элементы интерфейса
              from: 'ui',
              allow: [ 'react', 'tailwind'],
            },
            { // 5. Занимается маршрутизацией в веб-браузере
              from: 'router',
              allow: ['registry', 'ui', 'next'],
            },
            { // 6. Подключает инструменты (декабрь 2025: ESLint не видит динамических импортов)
              from: 'registry',
              allow: 'tool',
            },
            { // 7. Помогают разработчику
              from: 'script',
              allow: ['node', 'library'],
            },
            { // 8. Соединяет сложные вещи (стремится к свободе от стилей)
              from: ['tool', 'tool-subsystem'],
              allow: ['tool-subsystem', 'react', 'ui', 'library', 'browser', 'tailwind'],
            },
          ],
        },
      ],
      'boundaries/entry-point': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react-hooks/exhaustive-deps': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },

  // Правила именования (PascalCase для View, kebab-case для остальных)
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
  // СТРОГИЕ ПРАВИЛА TS
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