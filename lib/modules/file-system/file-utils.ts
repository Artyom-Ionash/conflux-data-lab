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

export function preprocessContent(content: string, extension: string): string {
  let cleaned = content;

  if (extension === 'tres') {
    const noiseTypes = [
      'AtlasTexture',
      'StyleBoxTexture',
      'StyleBoxFlat',
      'Theme',
      'TileSetAtlasSource',
      'BitMap',
      'Gradient',
      'GradientTexture1D',
      'FastNoiseLite',
      'NoiseTexture2D',
      'CapsuleShape2D',
      'CircleShape2D',
      'RectangleShape2D',
      'BoxShape3D',
      'SphereShape3D',
      'FontVariation',
      'SpriteFrames',
    ].join('|');

    const noiseRegex = new RegExp(
      `\\[sub_resource type="(${noiseTypes})"[\\s\\S]*?(?=\\n\\[|$)`,
      'g'
    );
    cleaned = cleaned.replaceAll(noiseRegex, '');
    cleaned = cleaned.replaceAll(
      /^\[ext_resource.*path=".*\.(png|jpg|jpeg|webp|svg|mp3|wav|ogg|ttf|otf)".*\]$/gm,
      ''
    );
    cleaned = cleaned.replaceAll(/^tracks\/.*$/gm, '');
    cleaned = cleaned.replaceAll(/\n{3,}/g, '\n\n');
  }

  if (extension === 'godot') {
    cleaned = cleaned.replaceAll(/Object\((InputEvent[^,]+),[^)]+\)/g, '$1(...)');
    cleaned = cleaned.replaceAll('"events": []', '');
    cleaned = cleaned.replaceAll('\n\n[', '\n[');
  }

  return cleaned;
}

export function calculateFileScore(name: string): number {
  const lower = name.toLowerCase();
  if (lower === 'package.json' || lower === 'project.godot') return 0;
  if (
    lower.includes('tsconfig') ||
    lower.includes('eslint') ||
    lower.includes('prettier') ||
    lower.includes('gitignore') ||
    lower.includes('next.config') ||
    lower.includes('tailwind.config')
  )
    return 0.5;
  if (
    lower.endsWith('.gd') ||
    lower.endsWith('.ts') ||
    lower.endsWith('.js') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.py')
  )
    return 1;
  if (lower.endsWith('.tscn')) return 2;
  return 3;
}
