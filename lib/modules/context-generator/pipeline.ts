import { pipe } from 'remeda';

import { getLanguageTag } from '@/lib/modules/file-system/file-utils';
import { GodotSceneParser } from '@/lib/modules/file-system/godot-scene';

// --- Types ---

export interface RawFile {
  name: string;
  path: string;
  content: string;
  extension: string;
}

export interface ContextFile {
  path: string;
  content: string;
  langTag: string;
  score: number;
  originalSize: number;
  cleanedSize: number;
}

// --- Logic (Pure Functions) ---

const sceneParser = new GodotSceneParser();

function preprocessGodotText(content: string): string {
  let cleaned = content;

  // Удаление "шума" из .tres файлов
  const noiseTypes = [
    'AtlasTexture',
    'StyleBoxTexture',
    'StyleBoxFlat',
    'Theme',
    'TileSetAtlasSource',
    'BitMap',
    'Gradient',
    'FastNoiseLite',
    'NoiseTexture2D',
    'CapsuleShape2D',
    'CircleShape2D',
    'RectangleShape2D',
    'BoxShape3D',
    'SphereShape3D',
  ].join('|');

  const noiseRegex = new RegExp(
    `\\[sub_resource type="(${noiseTypes})"[\\s\\S]*?(?=\\n\\[|$)`,
    'g'
  );

  cleaned = cleaned
    .replaceAll(noiseRegex, '')
    .replaceAll(
      /^\[ext_resource.*path=".*\.(png|jpg|jpeg|webp|svg|mp3|wav|ogg|ttf|otf)".*\]$/gm,
      ''
    )
    .replaceAll(/^tracks\/.*$/gm, '')
    .replaceAll(/\n{3,}/g, '\n\n')
    // Godot specific cleanups
    .replaceAll(/Object\((InputEvent[^,]+),[^)]+\)/g, '$1(...)')
    .replaceAll('"events": []', '')
    .replaceAll('\n\n[', '\n[');

  return cleaned;
}

/**
 * Оценка важности файла для сортировки в контексте
 */
export function calculateFileScore(name: string, ext: string = ''): number {
  const lower = name.toLowerCase();
  const extension = ext || name.split('.').pop() || '';

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

  const highPriority = ['gd', 'ts', 'js', 'tsx', 'jsx', 'py', 'cs'];
  if (highPriority.includes(extension)) return 1;

  if (extension === 'tscn') return 2;
  return 3;
}

// --- Transformers (Pipeline Steps) ---

const transformContent = (file: RawFile): RawFile => {
  let cleaned = file.content;

  // 1. Godot Scene Parsing
  if (file.extension === 'tscn') {
    try {
      const treeOutput = sceneParser.parse(file.content);
      cleaned = `; [Godot Scene Tree View]\n; Hierarchy only.\n\n${treeOutput}`;
    } catch {
      cleaned = preprocessGodotText(file.content);
    }
  }
  // 2. Godot Resources & Configs
  else if (file.extension === 'tres' || file.extension === 'godot') {
    cleaned = preprocessGodotText(file.content);
  }

  return { ...file, content: cleaned };
};

const enrichMetadata = (file: RawFile): ContextFile => {
  const langTag = file.extension === 'tscn' ? 'text' : getLanguageTag(file.name);
  const score = calculateFileScore(file.name, file.extension);

  return {
    path: file.path,
    content: file.content,
    langTag,
    score,
    originalSize: 0, // Placeholder, заполняется во внешнем враппере или можно добавить шаг
    cleanedSize: file.content.length,
  };
};

// --- Main Pipeline ---

export function processFileToContext(file: RawFile): ContextFile {
  const result = pipe(file, transformContent, enrichMetadata);

  return { ...result, originalSize: file.content.length };
}
