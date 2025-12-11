import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import boundaries from "eslint-plugin-boundaries";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import tailwind from "eslint-plugin-tailwindcss";

const eslintConfig = defineConfig([
  // 1. Базовые конфиги
  ...nextVitals,
  ...nextTs,
  // Подключаем рекомендуемый конфиг Tailwind (он добавит правила сортировки)
  ...tailwind.configs["flat/recommended"],

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
      // tailwind плагин уже подключен через spread выше
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
      // Настройки Tailwind плагина
      tailwindcss: {
        callees: ["classnames", "clsx", "ctl", "cn"], // Если используете утилиту cn()
        // В v4 конфига может не быть, поэтому плагин может ругаться в консоль, 
        // но сортировка работать будет.
        removeDuplicates: true,
      },
    },
    rules: {
      // ИМПОРТЫ
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",

      // TAILWIND
      // Автоматическая сортировка классов (главная фича!)
      "tailwindcss/classnames-order": "warn",
      // В v4 классы генерируются на лету из CSS, плагин их "не видит".
      // Обязательно отключаем, иначе будет куча ложных ошибок.
      "tailwindcss/no-custom-classname": "off",

      // UNICORN (Ваша текущая рабочая настройка)
      ...eslintPluginUnicorn.configs["flat/recommended"].rules,
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
      "unicorn/no-array-sort": "warn",
      "unicorn/no-array-reverse": "warn",
      "unicorn/consistent-function-scoping": "warn",
      // Доп. отключения из прошлого лога
      "unicorn/prefer-global-this": "off",
      "unicorn/no-negated-condition": "off",
      "unicorn/no-lonely-if": "off",
      "unicorn/explicit-length-check": "off",
      "unicorn/prefer-set-has": "off",
      "unicorn/prefer-ternary": "off",
      "unicorn/no-for-loop": "off",
      "unicorn/prefer-type-error": "off",
      "unicorn/empty-brace-spaces": "off",
      "unicorn/prefer-string-slice": "off",
      "unicorn/prefer-math-min-max": "off",
      "unicorn/prefer-string-raw": "off",

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