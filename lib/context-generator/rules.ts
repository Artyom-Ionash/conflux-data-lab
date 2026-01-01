/**
 * Глобальные правила игнорирования и пресеты для генератора контекста.
 */

// Папки, которые физически тяжело сканировать в браузере (тысячи файлов).
// Используются для раннего отсечения (Early Exit) в сканерах.
export const HEAVY_DIRS = [
  'node_modules',
  '.venv',
  '.git',
  '.next',
  '.vercel',
  'out',
  'dist',
  'build',
  'coverage',
  '.godot',
  '.import', // Godot imports folder
  '.gradle',
  '.idea',
  '.vscode',
  'target', // Rust/Java
  '__pycache__',
];

// Файлы и папки, которые не несут семантической ценности для LLM.
export const IGNORE_COMMON = [
  ...HEAVY_DIRS,
  '.context',
  '.DS_Store',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'LICENSE',
  'LICENSE.txt',
  'CHANGELOG.md',
  '*.pyc', // 👈 Игнорирование скомпилированных файлов Python
];

export const LOCAL_CONTEXT_FOLDER = '.ai';

export const MANDATORY_REPO_FILES = [
  'docs/ENGINEER_PROFILE.md',
  'docs/ARCHITECTURE.md',
  'docs/CONTRIBUTING.md',
  'docs/TECH_DEBT.md',
];

export interface ContextPreset {
  name: string;
  textExtensions: string[];
  hardIgnore: string[];
  /** Пути, которые отображаются в дереве, но контент которых исключается */
  treeOnly: string[];
}

// Используем satisfies вместо явного Record<string, ContextPreset>
export const CONTEXT_PRESETS = {
  godot: {
    name: 'Godot 4 (Logic Only)',
    textExtensions: [
      '.gd',
      '.tscn',
      '.godot',
      '.tres',
      '.cfg',
      '.gdshader',
      '.json',
      '.txt',
      '.md',
      '.py',
    ],
    // Используем Set для дедупликации, если IGNORE_COMMON пересечется с уникальными
    hardIgnore: [...new Set([...IGNORE_COMMON, 'builds', '*.uid', '*.import'])],
    treeOnly: ['addons/'],
  },
  nextjs: {
    name: 'Next.js / React',
    textExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.json', '.md', '.yaml'],
    hardIgnore: [...IGNORE_COMMON],
    treeOnly: ['public/'],
  },
} satisfies Record<string, ContextPreset>;

export type PresetKey = keyof typeof CONTEXT_PRESETS;
