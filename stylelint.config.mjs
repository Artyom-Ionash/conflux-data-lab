/** @type {import('stylelint').Config} */
const stylelintConfig = {
  extends: ['stylelint-config-standard'],
  rules: {
    // Разрешаем писать @import "tailwindcss" (строкой), а не url("...")
    'import-notation': 'string',

    // Отключаем правило вложенности, так как @utility в Tailwind v4 
    // создает контекст, который Stylelint пока не распознает.
    'nesting-selector-no-missing-scoping-root': null,

    // Разрешаем специфичные директивы Tailwind v4
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: [
          'tailwind',
          'apply',
          'variants',
          'responsive',
          'screen',
          'layer',
          'theme',
          'import',
          'plugin',
          'utility',
          'custom-variant',
        ],
      },
    ],
    // Разрешаем функцию theme()
    'function-no-unknown': [
      true,
      {
        ignoreFunctions: ['theme'],
      },
    ],
    // Отключаем лишние проверки для Tailwind
    'no-empty-source': null,
    'selector-class-pattern': null,
    'custom-property-pattern': null,
  },
};

export default stylelintConfig;
