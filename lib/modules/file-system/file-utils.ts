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
  editorconfig: 'ini',
  prettierrc: 'json',
  eslintrc: 'json',
  sworc: 'json',
};

export function getLanguageTag(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  const ext = parts.pop() || 'text';

  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    return LANGUAGE_MAP[ext] || 'text';
  }

  if (ext === 'tscn') return 'text';

  return LANGUAGE_MAP[ext] || ext;
}

export function isTextFile(filename: string, allowedExtensions: string[]): boolean {
  const lowerName = filename.toLowerCase();

  // Hardcoded binary/lock blocklist
  if (
    lowerName === 'package-lock.json' ||
    lowerName === 'yarn.lock' ||
    lowerName === 'pnpm-lock.yaml' ||
    lowerName === 'bun.lockb' ||
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.ico')
  ) {
    return false;
  }

  const configWhitelist = [
    'project.godot',
    'package.json',
    'tsconfig.json',
    'jsconfig.json',
    'dockerfile',
    '.gitignore',
    '.editorconfig',
    '.npmrc',
    '.prettierrc',
    '.eslintrc',
    '.sworc',
  ];

  if (configWhitelist.includes(lowerName)) return true;

  if (lowerName.startsWith('.eslintrc') || lowerName.startsWith('.prettierrc')) return true;
  if (
    lowerName.startsWith('eslint.config') ||
    lowerName.startsWith('next.config') ||
    lowerName.startsWith('tailwind.config') ||
    lowerName.startsWith('postcss.config') ||
    lowerName.startsWith('vite.config')
  )
    return true;

  return allowedExtensions.some((ext) => lowerName.endsWith(ext));
}

export function shouldIgnore(path: string, ignorePatterns: string[]): boolean {
  const normalizedPath = path.replaceAll('\\', '/');
  const filename = normalizedPath.split('/').pop() || '';
  const lowerFilename = filename.toLowerCase();

  for (const pattern of ignorePatterns) {
    const lowerPattern = pattern.toLowerCase();

    // Handle extensions (*.svg)
    if (lowerPattern.startsWith('*.')) {
      if (lowerFilename.endsWith(lowerPattern.slice(1))) return true;
      continue;
    }

    // Handle exact filename match (.git)
    if (lowerFilename === lowerPattern) {
      return true;
    }

    // Handle directory/path match (node_modules)
    if (
      normalizedPath.includes(`/${lowerPattern}/`) ||
      normalizedPath.startsWith(`${lowerPattern}/`)
    ) {
      return true;
    }
  }
  return false;
}
