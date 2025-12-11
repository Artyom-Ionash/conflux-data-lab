import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";
import simpleImportSort from "eslint-plugin-simple-import-sort";

const eslintConfig = defineConfig([
  // 1. Настройки Next.js (из твоего исходника)
  ...nextVitals,
  ...nextTs,

  // 2. Игнорируемые файлы
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // 3. Плагины и правила
  {
    plugins: {
      "simple-import-sort": simpleImportSort,
      "boundaries": boundaries, // Подключаем boundaries
    },
    settings: {
      // Настраиваем элементы архитектуры для boundaries
      "boundaries/include": ["app/**/*", "lib/**/*"],
      "boundaries/elements": [
        {
          type: "app-layer",
          pattern: "app/(page|layout|loading|error|not-found|tools/**/page).tsx",
          mode: "file",
        },
        {
          type: "feature",
          pattern: "app/components/tools/*",
          capture: ["featureName"],
        },
        {
          type: "domain",
          pattern: ["app/components/domain/*", "lib/domain/*"],
          capture: ["domainName"],
        },
        {
          type: "ui",
          pattern: "app/components/ui/*",
          mode: "folder",
        },
        {
          type: "lib",
          pattern: "lib/(config|utils|types)/*",
          mode: "folder",
        },
      ],
    },
    rules: {
      // Твои правила сортировки
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // --- ПРАВИЛА ГРАНИЦ (BOUNDARIES) ---
      "boundaries/element-types": [
        "error",
        {
          default: "allow",
          rules: [
            // UI компоненты (тупые) не могут зависеть от умных слоев
            {
              from: "ui",
              disallow: ["feature", "domain", "app-layer"],
              message: "❌ UI компоненты (app/components/ui) должны быть изолированы",
            },
            // Доменная логика не знает о конкретных инструментах
            {
              from: "domain",
              disallow: ["feature", "app-layer"],
              message: "❌ Домен (domain) не должен зависеть от фич (feature)",
            },
            // Утилиты — самый низкий слой
            {
              from: "lib",
              disallow: ["feature", "ui", "domain", "app-layer"],
              message: "❌ Lib не должна зависеть от компонентов приложения",
            },
            // Инструменты изолированы друг от друга
            {
              from: "feature",
              disallow: [
                ["feature", { featureName: "!${from.featureName}" }]
              ],
              message: "❌ Инструмент не может импортировать другой инструмент напрямую",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;