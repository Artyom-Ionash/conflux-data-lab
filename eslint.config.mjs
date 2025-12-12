
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'scripts/**']),

  {
    plugins: {
      'simple-import-sort': simpleImportSort,
      boundaries: boundaries,
      unicorn: eslintPluginUnicorn,
    },
    settings: {
      'boundaries/include': ['app/**/*', 'lib/**/*'],
      'boundaries/elements': [
        // 1. App Layer
        {
          type: 'app-layer',
          pattern: 'app/(page|layout|loading|error|not-found|tools/**/page).tsx',
          mode: 'file',
        },
        // 2. Tools (Ваши инструменты) - переименовал тип в 'tool'
        {
          type: 'tool',
          pattern: 'app/components/tools/*',
          capture: ['toolName'],
        },
        // 3. Entities (Ваши сущности)
        {
          type: 'entity',
          pattern: ['app/components/entities/*', 'lib/domain/*'],
          capture: ['entityName'],
        },
        // 4. Primitives (Ваши базовые UI)
        {
          type: 'primitives',
          pattern: 'app/components/primitives/*',
          mode: 'folder',
        },
        // 5. Shared Lib
        {
          type: 'lib',
          pattern: 'lib/(config|utils|types)/*',
          mode: 'folder',
        },
      ],
    },
    rules: {
      // ... (Правила импортов и unicorn остаются без изменений) ...
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      // ... unicorn rules ...

      // BOUNDARIES
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            // Primitives
            {
              from: 'primitives',
              disallow: ['tool', 'entity', 'app-layer'],
              message: '❌ Primitives (UI) не должны зависеть от бизнес-логики',
            },
            // Entities
            {
              from: 'entity',
              disallow: ['tool', 'app-layer'],
              message: '❌ Entities не должны зависеть от конкретных Tools',
            },
            // Lib
            {
              from: 'lib',
              disallow: ['tool', 'primitives', 'entity', 'app-layer'],
              message: '❌ Lib не должна зависеть от приложения',
            },
            // Tools (Изоляция инструментов друг от друга)
            {
              from: 'tool',
              // Запрещаем импорт из tool, если его имя (toolName) не совпадает с текущим
              disallow: [['tool', { toolName: '!${from.toolName}' }]],
              message: '❌ Инструмент должен быть изолирован от других инструментов',
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;