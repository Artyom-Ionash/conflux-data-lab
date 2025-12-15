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
        // 1. App Layer (Pages & Layouts)
        {
          type: 'app-layer',
          pattern: 'app/(page|layout|loading|error|not-found|tools/**/page).tsx',
          mode: 'file',
        },
        // 2. Tools (Feature Widgets)
        {
          type: 'tool',
          pattern: 'app/components/tools/*',
          capture: ['toolName'],
        },
        // 3. Entities (Domain-specific UI)
        {
          type: 'entity',
          pattern: 'app/components/entities/*',
          capture: ['entityName'],
        },
        // 4. Primitives (Generic UI)
        {
          type: 'primitives',
          pattern: 'app/components/primitives/*',
          mode: 'folder',
        },
        // 5. Modules (Business Logic: graphics, file-system, tool-registry)
        {
          type: 'module',
          pattern: 'lib/modules/*',
          mode: 'folder',
          capture: ['moduleName'],
        },
        // 6. Core (Low-level Utils, Hooks, Global Types)
        {
          type: 'core',
          pattern: ['lib/core/*', 'lib/types/*'],
          mode: 'folder',
        },
      ],
    },
    rules: {
      // Import sorting
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      // BOUNDARIES RULES
      'boundaries/element-types': [
        'error',
        {
          default: 'allow',
          rules: [
            // Core: Bottom layer, no dependencies allowed
            {
              from: 'core',
              disallow: ['module', 'primitives', 'entity', 'tool', 'app-layer'],
              message: '❌ Core (lib/core, lib/types) must not depend on upper layers',
            },
            // Modules: Business logic, depends only on Core
            {
              from: 'module',
              disallow: ['primitives', 'entity', 'tool', 'app-layer'],
              message: '❌ Modules (lib/modules) must not depend on UI components',
            },
            // Primitives: Generic UI, depends only on Core (e.g. cn utility, hooks)
            {
              from: 'primitives',
              disallow: ['module', 'entity', 'tool', 'app-layer'],
              message: '❌ Primitives (UI) must not depend on Business Logic or Entities',
            },
            // Entities: Domain UI, depends on Modules, Primitives, Core
            {
              from: 'entity',
              disallow: ['tool', 'app-layer'],
              message: '❌ Entities must not depend on specific Tools or Pages',
            },
            // Tools: Feature isolation
            {
              from: 'tool',
              disallow: [
                // No cross-tool imports
                ['tool', { toolName: '!${from.toolName}' }],
                // Tools shouldn't import pages
                'app-layer',
              ],
              message: '❌ Tools must be isolated from each other and the App Layer',
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;