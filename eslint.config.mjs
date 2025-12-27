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

  // 1. MAIN CONFIGURATION (Plugins & Boundaries)
  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      boundaries: boundaries,
      unicorn: eslintPluginUnicorn,
    },
    settings: {
      'boundaries/include': ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
      
      'boundaries/elements': [
        // --- CORE ---
        { type: 'core-primitives', pattern: 'core/primitives/**', mode: 'file' },
        { type: 'core-browser', pattern: 'core/browser/**', mode: 'file' },
        { type: 'core-react', pattern: 'core/react/**', mode: 'file' },
        { type: 'core-tailwind', pattern: 'core/tailwind/**', mode: 'file' },
        { type: 'core-next', pattern: 'core/next/**', mode: 'file' },
        { type: 'core-node', pattern: 'core/node/**', mode: 'file' },
        { type: 'core-typescript', pattern: 'core/typescript/**', mode: 'file' },

        // --- UI HIERARCHY ---
        { type: 'ui-atom', pattern: 'ui/atoms/**/*', mode: 'file' },
        { type: 'ui-molecule', pattern: 'ui/molecules/**/*', mode: 'file' },

        // --- APP LOGIC ---
        { type: 'lib', pattern: 'lib', mode: 'folder' },
        { type: 'feature', pattern: 'features/*', mode: 'file' },
        { type: 'feature-subsystem', pattern: 'features/**/*', mode: 'file' },
        { type: 'app', pattern: 'app', mode: 'folder' },
        { type: 'scripts', pattern: 'scripts/**', mode: 'file' },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: '*', allow: 'core-primitives' },
            { from: 'core-react', allow: 'core-browser' },
            { 
              from: 'ui-atom', 
              allow: ['core-react', 'core-tailwind', 'core-browser'] 
            },
            { 
              from: 'ui-molecule', 
              allow: ['core-react', 'core-tailwind', 'core-browser', 'ui-atom', 'ui-molecule'] 
            },
            { from: 'lib', allow: ['core-browser', 'core-react', 'core-typescript'] },
            { 
              from: 'feature', 
              allow: ['ui-atom', 'ui-molecule', 'lib', 'core-react', 'core-browser', 'feature-subsystem'] 
            },
            { 
              from: 'feature-subsystem', 
              allow: [ 'ui-atom', 'ui-molecule', 'lib', 'core-react', 'core-browser'] 
            },
            { from: 'app', allow: ['ui-atom', 'core-next', 'feature'] },
            { from: 'scripts', allow: ['core-node', 'lib'] },
          ],
        },
      ],
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
  
  // 2. NAMING CONVENTIONS
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

  // 3. STRICT TYPESCRIPT
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

  // 4. GLOBAL INTEGRITY POLICIES (Types & Styling)
  // Применяется ко всем TS/TSX файлам проекта
  {
    files: ['**/*.{ts,tsx}'],
    ignores: ['core/primitives/guards.ts', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        // [Policy] Type Integrity
        {
          selector: "TSAsExpression:not([typeAnnotation.typeName.name='const'])",
          message: '⛔ UNSAFE CAST. Использование "as Type" скрывает ошибки.\nREAD: docs/CONTRIBUTING.md:62:1',
        },
        {
          selector: 'TSTypeAssertion',
          message: '⛔ LEGACY CAST. Используйте Type Guards.\nREAD: docs/CONTRIBUTING.md:62:1',
        },
        // [Policy] Z-Index Topology (НОВОЕ ПРАВИЛО)
        {
          // Запрещаем все числовые z-классы, кроме z-auto и z--.
          selector: "JSXAttribute[name.name='className'] Literal[value=/z-(?!(auto|--))\\d+/]",
          message: '⛔ MAGIC Z-INDEX. Используйте семантические слои: z-(--z-content), z-(--z-overlay) из layers.css.',
        },
      ],
    },
  },

  // 5. UI ISOLATION POLICY (Architectural)
  // Запрещает HTML-теги везде, кроме папки UI.
  // Это правило должно быть в отдельном блоке, так как у него есть специфичный ignores: ['ui/**'].
  {
    files: ['**/*.tsx'],
    ignores: ['ui/**', 'app/**', 'core/browser/**', 'core/react/**'], 
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXOpeningElement > JSXIdentifier[name=/^[a-z]/]",
          message: "⛔ RAW HTML. Верстка должна быть в 'ui/'.\nREAD: docs/CONTRIBUTING.md:62:1",
        },
      ],
    },
  },
  
  eslintConfigPrettier,
]);

export default eslintConfig;
