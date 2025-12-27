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
        // --- 1. CORE KERNEL (Нижний слой, без зависимостей) ---
        { type: 'core-typescript', pattern: 'core/typescript/**', mode: 'file' },
        { type: 'core-primitives', pattern: 'core/primitives/**', mode: 'file' },
        { type: 'core-browser', pattern: 'core/browser/**', mode: 'file' },
        { type: 'core-react', pattern: 'core/react/**', mode: 'file' },
        { type: 'core-tailwind', pattern: 'core/tailwind/**', mode: 'file' },
        { type: 'core-next', pattern: 'core/next/**', mode: 'file' },
        { type: 'core-node', pattern: 'core/node/**', mode: 'file' },

        // --- 2. APP LAYER (Маршрутизация и глобальные настройки) ---
        { type: 'app', pattern: 'app', mode: 'folder' },
        
        // --- 3. UI LAYER (Дизайн-система) ---
        { type: 'ui', pattern: 'ui/**', mode: 'file' },

        // --- 4. BUSINESS LOGIC (Чистая логика) ---
        { type: 'lib', pattern: 'lib', mode: 'folder' },

        // --- 5. FEATURES (Инструменты) ---
        { type: 'feature', pattern: 'features/*', mode: 'file' },
        { type: 'feature-subsystem', pattern: 'features/**/*', mode: 'file' },

        // --- 6. DEV LAYER (Разработка) ---
        { type: 'scripts', pattern: 'scripts/**', mode: 'file' },
      ],
    },
    rules: {
      // Иерархия импортов (Белый список)
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: '*', allow: 'core-primitives' },
            { from: 'core-react', allow: 'core-browser' },
            { from: 'ui', allow: ['core-react', 'core-tailwind'] },
            { from: 'lib', allow: ['core-browser', 'core-react', 'core-typescript'] },
            { from: 'feature', allow: ['ui', 'lib', 'core-react', 'core-browser', 'feature-subsystem'] },
            { from: 'feature-subsystem', allow: ['ui', 'lib', 'core-react', 'core-browser'] },
            { from: 'app', allow: ['ui', 'core-next', 'feature'] },
            { from: 'scripts', allow: ['core-node', 'lib'] },
          ],
        },
      ],

      // Защита приватных файлов и точек входа
      'boundaries/entry-point': [
        'error',
        {
          default: 'allow',
          rules: [
            {
              target: '*',
              disallow: '**/_*', // Запрещаем импорт из любых папок с нижним подчеркиванием (_io, _components)
            }
          ]
        }
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react-hooks/exhaustive-deps': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
    },
  },

  // Правила именования файлов
  {
    files: ['**/*.{ts,tsx,mts,js,mjs}'],
    rules: {
      'unicorn/filename-case': [
        'error',
        {
          case: 'kebabCase',
           // Разрешаем:
          // 1. _underscore prefix (приватные папки)
          // 2. Dockerfile (стандарт)
          ignore: [/^_/, /^Dockerfile$/],
        },
      ],
    },
  },
  // PascalCase для компонентов (UI и Features)
  {
    files: ['ui/**/*.tsx', 'features/**/*.tsx', 'app/_ui/**/*.tsx'],
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

  // --- ПОЛИТИКА "ZERO-AS" (ЗАПРЕТ TYPE ASSERTIONS) ---
  // Применяется глобально ко всем TS файлам.
  // Запрещает `data as Type`, разрешает `data as const`.
  {
    files: ['**/*.{ts,tsx}'], // Глобальный скоуп
    ignores: [
      // --- SAFE ZONES (Где приведение типов необходимо) ---

      // 1. CORE: Здесь создаются сами Type Guards.
      'core/primitives/guards.ts', 

      // 2. TESTS: В тестах (включая UI-тесты) часто нужны моки.
      // FIX: Добавлена поддержка .tsx для тестов компонентов (например, Workbench.test.tsx)
      '**/*.test.{ts,tsx}', 
      '**/*.spec.{ts,tsx}',
    ],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // Запрещаем 'as Type'.
          // Исключение: 'as const' (typeAnnotation.typeName.name === 'const')
          selector: "TSAsExpression:not([typeAnnotation.typeName.name='const'])",
          // message:
          //   '⛔ UNSAFE CAST DETECTED.\nИспользование "as Type" запрещено, так как это скрывает ошибки типов.\n\n✅ Решение:\n1. Используйте Type Guard (isDefined, isObject) из "@/core/primitives/guards".\n2. Используйте валидацию (Zod) для внешних данных.\n3. Если это библиотека, создайте безопасную обертку в "core/".',
        },
        {
          // Запрещаем старый синтаксис <Type>variable
          selector: 'TSTypeAssertion',
          message: 'Использование <Type>assertion запрещено. Используйте безопасные методы.',
        },
      ],
    },
  },
  // --- ПОЛИТИКА "ZERO-HTML" (Features, Libs, Core) ---
  // Запрещает использование стандартных HTML тегов (div, span, img) в слоях бизнес-логики и ядра.
  // Разрешает: React Components (PascalCase) и Fragment (<>).
  {
    files: ['**/*.tsx'],
    // Можно добавить исключения, если есть специфические файлы, где HTML необходим
    ignores: [
      'ui/**',
      'app/**',
      'core/browser/**',
      'core/react/**',
    ], 
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          // AST Селектор: 
          // 1. Ищем открывающий тег JSX.
          // 2. Проверяем имя тега.
          // 3. Если имя начинается с маленькой буквы (a-z) -> это HTML тег.
          selector: "JSXOpeningElement > JSXIdentifier[name=/^[a-z]/]",
          // message:
          //   "⛔ RAW HTML DETECTED.\nВ этом слое запрещено использовать сырой HTML (div, span, button...).\n✅ Используйте компоненты дизайн-системы из '@/ui/':\n- ui/layout (Box, Stack, Group)\n- ui/primitive (Typography, Icon)\n- ui/input (Button, Input)",
        },
      ],
    },
  },
  
  eslintConfigPrettier,
]);

export default eslintConfig;
