/**
 * Анализаторы типов файлов и языков программирования.
 */

export const LANGUAGE_MAP: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  gd: 'gdscript',
  shader: 'glsl',
  gdshader: 'glsl',
  html: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  json: 'json',
  json5: 'json',
  md: 'markdown',
  txt: 'text',
  godot: 'ini',
  tscn: 'ini',
  tres: 'ini',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  gitignore: 'gitignore',
  dockerfile: 'dockerfile',
  editorconfig: 'ini',
  prettierrc: 'json',
  eslintrc: 'json',
  sworc: 'json',
};

// Файлы, которые ВСЕГДА являются текстовыми, независимо от расширения
const ALWAYS_TEXT_FILENAMES = new Set([
  'project.godot',
  'package.json',
  'tsconfig.json',
  'jsconfig.json',
  'dockerfile',
  '.gitignore',
  '.npmrc',
  '.editorconfig',
  '.prettierrc',
  '.eslintrc',
  '.sworc',
  '.env',
  '.env.local',
  '.env.example',
  '.pre-commit-config.yaml',
  'license', // Часто без расширения
  'readme', // Часто без расширения
]);

// Префиксы файлов, которые всегда текстовые (например, .eslintrc.json)
const ALWAYS_TEXT_PREFIXES = [
  '.eslintrc',
  '.prettierrc',
  'eslint.config',
  'next.config',
  'tailwind.config',
  'postcss.config',
  'vite.config',
  'webpack.config',
  'jest.config',
  'vitest.config',
];

export function getLanguageTag(filename: string): string {
  const lower = filename.toLowerCase();
  const parts = lower.split('.');

  // Обработка файлов без расширения (Dockerfile, LICENSE)
  if (parts.length === 1) {
    return LANGUAGE_MAP[lower] || 'text';
  }

  const ext = parts.pop() || 'text';

  if (ext === 'tscn') return 'text';

  return LANGUAGE_MAP[ext] || ext;
}

/**
 * Определяет, является ли файл текстовым.
 * Использует стратегию "Strict Allowlist" (По умолчанию всё - бинарное).
 */
export function isTextFile(filename: string, allowedExtensions: string[]): boolean {
  const lowerName = filename.toLowerCase();

  // 1. Проверка по точному имени (Config Whitelist)
  if (ALWAYS_TEXT_FILENAMES.has(lowerName)) {
    return true;
  }

  // 2. Проверка по префиксу конфигурации
  if (ALWAYS_TEXT_PREFIXES.some((prefix) => lowerName.startsWith(prefix))) {
    return true;
  }

  // 3. Проверка по расширению (User Config + Preset)
  // Если allowedExtensions пуст или содержит только пустые строки, вернется false.
  // Это автоматически отсекает .bmp, .exe и прочее, чего нет в списке.
  return allowedExtensions.some((ext) => ext && lowerName.endsWith(ext));
}

export function shouldIgnore(path: string, ignorePatterns: string[]): boolean {
  // Нормализация слэшей для кросс-платформенности
  const normalizedPath = path.replaceAll('\\', '/');
  const filename = normalizedPath.split('/').pop() || '';
  const lowerFilename = filename.toLowerCase();

  for (const pattern of ignorePatterns) {
    const lowerPattern = pattern.toLowerCase();

    // Pattern: "*.svg" -> проверка расширения
    if (lowerPattern.startsWith('*.')) {
      if (lowerFilename.endsWith(lowerPattern.slice(1))) return true;
      continue;
    }

    // Pattern: ".git" -> точное совпадение имени файла/папки
    if (lowerFilename === lowerPattern) {
      return true;
    }

    // Pattern: "node_modules" -> совпадение части пути (директории)
    // Проверяем вхождение как отдельного сегмента пути
    if (
      normalizedPath.includes(`/${lowerPattern}/`) ||
      normalizedPath.startsWith(`${lowerPattern}/`)
    ) {
      return true;
    }
  }
  return false;
}
