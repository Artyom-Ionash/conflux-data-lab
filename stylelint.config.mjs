/** @type {import('stylelint').Config} */
export default {
  extends: ["stylelint-config-standard"],
  rules: {
    // --- Исправление ошибки import-notation ---
    // Разрешаем писать @import "tailwindcss" (строкой), а не url("...")
    "import-notation": "string",

    // --- Специфика Tailwind v4 (оставляем как было) ---
    "at-rule-no-unknown": [
      true,
      {
        ignoreAtRules: [
          "tailwind",
          "apply",
          "variants",
          "responsive",
          "screen",
          "layer",
          "theme",
          "import",
          "plugin",
          "utility",
          "custom-variant",
        ],
      },
    ],
    "function-no-unknown": [
      true,
      {
        ignoreFunctions: ["theme"],
      },
    ],
    "no-empty-source": null,
    "selector-class-pattern": null,
    "custom-property-pattern": null,
  },
};