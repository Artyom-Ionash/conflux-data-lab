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

// Имя папки для локального контекста (игнорируется git, но читается генератором)
export const LOCAL_CONTEXT_FOLDER = '.ai';

// Файлы, которые ОБЯЗАНЫ быть в контексте, если они есть в репозитории
export const MANDATORY_REPO_FILES = [
  'docs/ENGINEER_PROFILE.md',
  'docs/ARCHITECTURE.md',
  'docs/CONTRIBUTING.md',
  'docs/TECH_DEBT.md',
];

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
      '.gitignore',
      '.sh',
    ],
    hardIgnore: [
      ...IGNORE_COMMON,
      '.godot',
      '.import',
      'builds',
      '__pycache__',
      '.next',
      'dist',
      'build',
      '*.uid',
      '*.import',
    ],
  },
  nextjs: {
    name: 'Next.js / React',
    textExtensions: [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.mjs',
      '.cjs',
      '.css',
      '.scss',
      '.sass',
      '.json',
      '.md',
      '.yaml',
      '.yml',
      '.toml',
      '.env.example',
      '.conf',
      '.xml',
      '.gd',
      '.tscn',
      'dockerfile',
      '.gitignore',
      '.sh',
    ],
    hardIgnore: [
      ...IGNORE_COMMON,
      '.next',
      'out',
      'build',
      'dist',
      'coverage',
      '.vercel',
      '.turbo',
      '__pycache__',
    ],
  },
};

export type PresetKey = keyof typeof CONTEXT_PRESETS;
