import { pipe } from 'remeda';

import { getLanguageTag } from '@/lib/modules/file-system/file-utils';
import { GodotSceneParser } from '@/lib/modules/file-system/godot-scene';

import { LOCAL_CONTEXT_FOLDER, MANDATORY_REPO_FILES } from './config';

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
    .replaceAll(/Object\((InputEvent[^,]+),[^)]+\)/g, '$1(...)')
    .replaceAll('"events": []', '')
    .replaceAll('\n\n[', '\n[');

  return cleaned;
}

export function calculateFileScore(name: string, ext: string = '', path: string = ''): number {
  const normalizedPath = path.replaceAll('\\', '/');

  // 0. LOCAL AI CONTEXT (Absolute Priority)
  // Все, что лежит в папке .ai, должно быть в самом верху
  if (
    normalizedPath.startsWith(LOCAL_CONTEXT_FOLDER) ||
    normalizedPath.includes(`/${LOCAL_CONTEXT_FOLDER}/`)
  ) {
    return -100;
  }

  // 1. Mandatory Documentation
  if (MANDATORY_REPO_FILES.includes(normalizedPath)) {
    return -10;
  }

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
    return 1;

  const highPriority = ['gd', 'ts', 'js', 'tsx', 'jsx', 'py', 'cs'];
  if (highPriority.includes(extension)) return 10;

  if (extension === 'tscn') return 20;
  return 50;
}

const transformContent = (file: RawFile): RawFile => {
  let cleaned = file.content;

  if (file.extension === 'tscn') {
    try {
      const treeOutput = sceneParser.parse(file.content);
      cleaned = `; [Godot Scene Tree View]\n; Hierarchy only.\n\n${treeOutput}`;
    } catch {
      cleaned = preprocessGodotText(file.content);
    }
  } else if (file.extension === 'tres' || file.extension === 'godot') {
    cleaned = preprocessGodotText(file.content);
  }

  return { ...file, content: cleaned };
};

const enrichMetadata = (file: RawFile): ContextFile => {
  const langTag = file.extension === 'tscn' ? 'text' : getLanguageTag(file.name);
  const score = calculateFileScore(file.name, file.extension, file.path);

  return {
    path: file.path,
    content: file.content,
    langTag,
    score,
    originalSize: 0,
    cleanedSize: file.content.length,
  };
};

export function processFileToContext(file: RawFile): ContextFile {
  const result = pipe(file, transformContent, enrichMetadata);
  return { ...result, originalSize: file.content.length };
}
