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
        { type: 'core-typescript', pattern: 'core/typescript/**', mode: 'file' },
        { type: 'core-primitives', pattern: 'core/primitives/**', mode: 'file' },
        { type: 'core-browser', pattern: 'core/browser/**', mode: 'file' },
        { type: 'core-react', pattern: 'core/react/**', mode: 'file' },
        { type: 'core-tailwind', pattern: 'core/tailwind/**', mode: 'file' },
        { type: 'core-next', pattern: 'core/next/**', mode: 'file' },
        { type: 'core-node', pattern: 'core/node/**', mode: 'file' },

        // --- 2. BUSINESS LOGIC ---
        { type: 'lib', pattern: 'lib', mode: 'folder' },
        { type: 'scripts', pattern: 'scripts/**', mode: 'file' },

        // --- 3. VIEW LAYER ---
        { type: 'ui', pattern: 'view/ui/**', mode: 'file' },
        
        // --- 4. ROUTER LAYER ---
        { type: 'registry', pattern: 'app/registry/tool-loader.tsx', mode: 'file' },
        { type: 'app', pattern: 'app/**', mode: 'file' },
        
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
            { from: '*', allow: 'core-primitives'}, // ОБЩЕЕ
            { from: 'core-react', allow: 'core-browser' }, // React использует веб-браузер
            { from: 'app', allow: ['registry', 'ui', 'core-next'] }, // Занимается маршрутизацией в веб-браузере
            { from: 'registry', allow: 'tool' }, // Подключает инструменты (декабрь 2025: ESLint не видит динамических импортов)
            { from: 'ui', allow: ['core-react', 'core-tailwind'] }, // Собирает простые элементы интерфейса
            { from: 'lib', allow: ['core-browser', 'core-react'] }, // Бизнес-логика (стремится к Framework-agnostic)
            { from: 'scripts', allow: ['core-node', 'lib'] }, // Помогают разработчику
            { from: ['tool', 'tool-subsystem'], allow: ['tool-subsystem', 'core-react', 'ui', 'lib', 'core-browser', 'core-tailwind'] }, // Соединяет сложные вещи (стремится к свободе от стилей)
          ],
        },
      ],
      'boundaries/entry-point': 'error',
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react-hooks/exhaustive-deps': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      // Настройка точек входа: запрещаем импорт файлов с нижним подчеркиванием извне модуля
      'boundaries/entry-point': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              target: '*',
              disallow: '**/_*', // Запрещаем любые файлы или папки с префиксом _ внутри library
              message: '❌ Нельзя импортировать приватные части библиотеки.'
            }
          ]
        }
      ],
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