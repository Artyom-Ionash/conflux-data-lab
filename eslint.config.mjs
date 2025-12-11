import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import eslintPluginUnicorn from "eslint-plugin-unicorn";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "scripts/**",
  ]),

  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      "boundaries": boundaries,
      "unicorn": eslintPluginUnicorn,
    },
    settings: {
      "boundaries/include": ["app/**/*", "lib/**/*"],
      "boundaries/elements": [
        { type: "app-layer", pattern: "app/(page|layout|loading|error|not-found|tools/**/page).tsx", mode: "file" },
        { type: "feature", pattern: "app/components/tools/*", capture: ["featureName"] },
        { type: "domain", pattern: ["app/components/domain/*", "lib/domain/*"], capture: ["domainName"] },
        { type: "ui", pattern: "app/components/ui/*", mode: "folder" },
        { type: "lib", pattern: "lib/(config|utils|types)/*", mode: "folder" },
      ],
    },
    rules: {
      // ИМПОРТЫ
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // UNICORN BASE
      ...eslintPluginUnicorn.configs["flat/recommended"].rules,

      // --- ОТКЛЮЧАЕМ ШУМНЫЕ ПРАВИЛА ---
      "unicorn/prevent-abbreviations": "off",
      "unicorn/filename-case": "off",
      "unicorn/no-null": "off",
      "unicorn/catch-error-name": "off",
      "unicorn/prefer-add-event-listener": "off",
      "unicorn/prefer-dom-node-text-content": "off",
      "unicorn/prefer-module": "off",
      "unicorn/no-array-reduce": "off",
      "unicorn/no-array-for-each": "off",
      "unicorn/no-nested-ternary": "off",
      "unicorn/import-style": "off",
      
      // Новые отключения (на основе вашего лога)
      "unicorn/prefer-global-this": "off",          // window is fine
      "unicorn/no-negated-condition": "off",        // if (!x) is fine
      "unicorn/no-lonely-if": "off",                // else { if } is sometimes readable
      "unicorn/explicit-length-check": "off",       // if (arr.length) is fine
      "unicorn/prefer-set-has": "off",              // array.includes is fine for small lists
      "unicorn/prefer-ternary": "off",              // if/else is often more readable
      "unicorn/no-for-loop": "off",                 // classical for loops are sometimes needed
      "unicorn/prefer-type-error": "off",           // new Error() is generic enough
      "unicorn/empty-brace-spaces": "off",          // Prettier handles this
      "unicorn/prefer-string-slice": "off",         // substr is legacy but works
      "unicorn/prefer-math-min-max": "off",         // Ternary is sometimes clearer
      "unicorn/prefer-string-raw": "off",           // Too pedantic for regex

      // Оставляем предупреждениями
      "unicorn/no-array-sort": "warn",
      "unicorn/no-array-reverse": "warn",
      "unicorn/consistent-function-scoping": "warn",

      // BOUNDARIES
      "boundaries/element-types": [
        "error",
        {
          default: "allow",
          rules: [
            { from: "ui", disallow: ["feature", "domain", "app-layer"], message: "❌ UI компоненты должны быть изолированы" },
            { from: "domain", disallow: ["feature", "app-layer"], message: "❌ Домен не должен зависеть от фич" },
            { from: "lib", disallow: ["feature", "ui", "domain", "app-layer"], message: "❌ Lib не должна зависеть от приложения" },
            { from: "feature", disallow: [["feature", { featureName: "!${from.featureName}" }]], message: "❌ Инструменты должны быть изолированы" },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;