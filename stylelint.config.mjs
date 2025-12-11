/** @type {import('stylelint').Config} */
const stylelintConfig = {
  extends: ['stylelint-config-standard'],
  rules: {
    // Разрешаем писать @import "tailwindcss" (строкой), а не url("...")
    'import-notation': 'string',

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
