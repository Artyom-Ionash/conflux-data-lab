export const IGNORE_COMMON = [
  '.git',
  '.idea',
  '.vscode',
  '.context',
  '.DS_Store',
  'node_modules',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'LICENSE',
  'LICENSE.txt',
  'CHANGELOG.md',
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
// Это позволяет TS знать, что ключи 'godot' и 'nextjs' точно существуют.
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
    hardIgnore: [...IGNORE_COMMON, '.godot', '.import', 'builds', '*.uid', '*.import'],
    treeOnly: ['addons/'],
  },
  nextjs: {
    name: 'Next.js / React',
    textExtensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.css', '.json', '.md', '.yaml'],
    hardIgnore: [...IGNORE_COMMON, '.next', 'out', 'dist', 'coverage', '.vercel'],
    treeOnly: ['public/'],
  },
} satisfies Record<string, ContextPreset>;

export type PresetKey = keyof typeof CONTEXT_PRESETS;
