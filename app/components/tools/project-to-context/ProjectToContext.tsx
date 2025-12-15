// conflux-data-lab/app/components/tools/project-to-context/ProjectToContext.tsx

'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

import { GodotSceneParser } from '@/lib/modules/file-system/godot-scene';
import { formatBytes, generateAsciiTree } from '@/lib/modules/file-system/tree-view';

import { Card } from '../../primitives/Card';
import { Switch } from '../../primitives/Switch';
import { ToolLayout } from '../ToolLayout';

// --- CONFIGURATION ---

const PRESETS = {
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
    ],
    hardIgnore: [
      '.git',
      '.godot',
      '.import',
      'builds',
      '__pycache__',
      'node_modules',
      '.next',
      '.vscode',
      '.idea',
      '*.uid',
      '*.import',
      '.DS_Store',
      'LICENSE',
      'LICENSE.txt',
      'LICENCE',
      'LICENCE.txt',
      'COPYING',
      'README.md',
      'CHANGELOG.md',
      'THIRDPARTY.md',
      'NOTICE',
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
    ],
    hardIgnore: [
      '.git',
      'node_modules',
      '.next',
      'dist',
      'build',
      'coverage',
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      '.DS_Store',
      '.vercel',
      '.turbo',
      'LICENSE',
      'LICENSE.txt',
      'LICENCE',
      'LICENCE.txt',
      'COPYING',
      'README.md',
      'CHANGELOG.md',
      'THIRDPARTY.md',
      'NOTICE',
    ],
  },
};

const LANGUAGE_MAP: Record<string, string> = {
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

type PresetKey = keyof typeof PRESETS;

interface FileNode {
  path: string;
  name: string;
  size: number;
  file: File;
  isText: boolean;
}

interface ProjectStats {
  totalFiles: number;
  processedFiles: number;
  totalChars: number;
  estimatedTokens: number;
  originalSize: number;
  cleanedSize: number;
  savings: {
    bytes: number;
    percentage: number;
  };
  composition: Record<string, number>;
  topFiles: { path: string; size: number; tokens: number }[];
}

// --- HELPERS ---

function getLanguageTag(filename: string): string {
  const parts = filename.toLowerCase().split('.');
  const ext = parts.pop() || 'text';

  if (parts.length === 0 || (parts.length === 1 && parts[0] === '')) {
    return LANGUAGE_MAP[ext] || 'text';
  }

  if (ext === 'tscn') return 'text';

  return LANGUAGE_MAP[ext] || ext;
}

function isTextFile(filename: string, extensions: string[]): boolean {
  const lowerName = filename.toLowerCase();

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

  return extensions.some((ext) => lowerName.endsWith(ext));
}

function shouldIgnore(path: string, ignorePatterns: string[]): boolean {
  const normalizedPath = path.replaceAll('\\', '/');
  const filename = normalizedPath.split('/').pop() || '';
  const lowerFilename = filename.toLowerCase();

  for (const pattern of ignorePatterns) {
    const lowerPattern = pattern.toLowerCase();

    if (lowerPattern.startsWith('*.')) {
      if (lowerFilename.endsWith(lowerPattern.slice(1))) return true;
      continue;
    }

    if (lowerFilename === lowerPattern) {
      return true;
    }

    if (
      normalizedPath.includes(`/${lowerPattern}/`) ||
      normalizedPath.startsWith(`${lowerPattern}/`)
    ) {
      return true;
    }
  }
  return false;
}

function preprocessContent(content: string, extension: string): string {
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

const readFileAsText = (file: File): Promise<string> => {
  return file.text();
};

const calculateFileScore = (name: string) => {
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
};

// --- COMPONENT ---

export function ProjectToContext() {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('godot');
  const [customExtensions, setCustomExtensions] = useState<string>(
    PRESETS.godot.textExtensions.join(', ')
  );
  const [customIgnore, setCustomIgnore] = useState<string>(PRESETS.godot.hardIgnore.join(', '));
  const [includeTree, setIncludeTree] = useState(true);

  const [files, setFiles] = useState<FileNode[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Добавлено: Состояние для времени последней генерации
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

  const [stats, setStats] = useState<ProjectStats | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePresetChange = (key: PresetKey) => {
    setSelectedPreset(key);
    setCustomExtensions(PRESETS[key].textExtensions.join(', '));
    setCustomIgnore(PRESETS[key].hardIgnore.join(', '));
  };

  const handleDirectorySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileList = [...e.target.files];

    let detectedPreset: PresetKey | null = null;
    const fileNames = fileList.map((f) => f.name);

    if (fileNames.includes('project.godot')) {
      detectedPreset = 'godot';
    } else if (
      fileNames.includes('next.config.js') ||
      fileNames.includes('next.config.ts') ||
      fileNames.includes('next.config.mjs') ||
      fileNames.includes('package.json')
    ) {
      detectedPreset = 'nextjs';
    }

    let activeIgnoreStr = customIgnore;
    let activeExtStr = customExtensions;

    if (detectedPreset && detectedPreset !== selectedPreset) {
      const preset = PRESETS[detectedPreset];
      setSelectedPreset(detectedPreset);
      setCustomExtensions(preset.textExtensions.join(', '));
      setCustomIgnore(preset.hardIgnore.join(', '));
      activeExtStr = preset.textExtensions.join(', ');
      activeIgnoreStr = preset.hardIgnore.join(', ');
    }

    const ignoreList = activeIgnoreStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const extList = activeExtStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const nodes: FileNode[] = [];
    fileList.forEach((f) => {
      const path = f.webkitRelativePath || f.name;
      if (shouldIgnore(path, ignoreList)) return;
      nodes.push({
        path: path,
        name: f.name,
        size: f.size,
        file: f,
        isText: isTextFile(f.name, extList),
      });
    });

    setFiles(nodes);
    setResult(null); // Сброс результата для триггера авто-генерации
    setStats(null);
  };

  const processFiles = useCallback(async () => {
    setProcessing(true);
    setProgress(0);
    setResult(null);

    const sortedFiles = [...files].sort((a, b) => {
      return calculateFileScore(a.name) - calculateFileScore(b.name);
    });

    const sceneParser = new GodotSceneParser();

    let totalOriginalBytes = 0;
    let totalCleanedBytes = 0;
    const composition: Record<string, number> = {};
    const processedFileStats: { path: string; size: number; tokens: number }[] = [];
    const processedFilesData: { node: FileNode; content: string; langTag: string }[] = [];

    let processedCount = 0;

    for (const node of sortedFiles) {
      if (!node.isText) {
        processedCount++;
        continue;
      }

      try {
        const originalText = await readFileAsText(node.file);
        totalOriginalBytes += originalText.length;

        const ext = node.name.split('.').pop() || 'txt';
        let cleanedText = '';
        let langKey = getLanguageTag(node.name);

        if (ext === 'tscn') {
          try {
            const treeOutput = sceneParser.parse(originalText);
            cleanedText = `; [Godot Scene Tree View]
; This file has been parsed to show the hierarchy only.
; Attributes and long sub-resources are hidden for context window efficiency.

${treeOutput}`;
            langKey = 'text';
          } catch (e) {
            console.warn('Parser failed for tscn, falling back to regex', e);
            cleanedText = preprocessContent(originalText, ext);
          }
        } else {
          cleanedText = preprocessContent(originalText, ext);
        }

        totalCleanedBytes += cleanedText.length;

        let reportLang = LANGUAGE_MAP[ext] || ext;
        if (node.name.includes('config') || node.name.startsWith('.')) reportLang = 'config/meta';

        composition[reportLang] = (composition[reportLang] || 0) + 1;

        processedFilesData.push({
          node,
          content: cleanedText,
          langTag: langKey,
        });

        processedFileStats.push({
          path: node.path,
          size: cleanedText.length,
          tokens: Math.ceil(cleanedText.length / 4),
        });
      } catch (e) {
        console.error(`Error processing ${node.path}`, e);
      }

      processedCount++;
      setProgress(Math.round((processedCount / sortedFiles.length) * 50));
      if (processedCount % 10 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    const estimatedTokens = Math.ceil(totalCleanedBytes / 4);
    const savingsBytes = totalOriginalBytes - totalCleanedBytes;
    const savingsPercent = totalOriginalBytes > 0 ? (savingsBytes / totalOriginalBytes) * 100 : 0;

    const topFiles = processedFileStats.sort((a, b) => b.size - a.size).slice(0, 5);

    setStats({
      totalFiles: sortedFiles.length,
      processedFiles: processedFilesData.length,
      totalChars: totalCleanedBytes,
      estimatedTokens,
      originalSize: totalOriginalBytes,
      cleanedSize: totalCleanedBytes,
      savings: { bytes: savingsBytes, percentage: savingsPercent },
      composition,
      topFiles,
    });

    let output = `<codebase_context>
<instruction>
The following is a flattened representation of a project codebase.
1. Use the <directory_structure> to understand the file hierarchy.
2. Content is in <source_files>, where each file is wrapped in a <file> tag.
3. Code blocks utilize standard Markdown triple backticks with language tags (e.g., \`\`\`python) for expert routing.
4. METRICS: Approximately ${estimatedTokens.toLocaleString()} tokens across ${
      processedFilesData.length
    } files.
</instruction>

<project_metrics>
  <token_count_estimate>${estimatedTokens}</token_count_estimate>
  <file_count>${processedFilesData.length}</file_count>
  <top_languages>
    ${Object.entries(composition)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([lang, count]) => `${lang} (${count})`)
      .join(', ')}
  </top_languages>
</project_metrics>

`;

    if (includeTree) {
      output += `<directory_structure>\n\`\`\`text\n${generateAsciiTree(
        sortedFiles
      )}\n\`\`\`\n</directory_structure>\n\n`;
    }

    output += `<source_files>\n\n`;

    processedFilesData.forEach((item, idx) => {
      output += `<file path="${item.node.path}">\n`;
      output += '```' + item.langTag + '\n';
      output += item.content;
      output += '\n```\n';
      output += `</file>\n\n`;

      if (idx % 10 === 0) setProgress(50 + Math.round((idx / processedFilesData.length) * 50));
    });

    output += `</source_files>\n</codebase_context>`;

    setResult(output);
    setLastGeneratedAt(new Date()); // Установка времени генерации
    setProcessing(false);
  }, [files, includeTree]); // processFiles зависит от файлов и настроек

  // --- AUTO-GEN EFFECT ---
  useEffect(() => {
    if (files.length > 0 && result === null && !processing) {
      void processFiles();
    }
  }, [files, result, processing, processFiles]);

  const downloadResult = () => {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gemini_context.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    if (!result) return;

    try {
      // 1. Попытка использовать современный API (HTTPS / Localhost)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(result);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      // FIX: Убрали неиспользуемую переменную (err)
      // 2. Фоллбэк для HTTP (старый метод через скрытый textarea)
      try {
        const textArea = document.createElement('textarea');
        textArea.value = result;

        // Делаем элемент невидимым, но доступным для фокуса
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);

        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (!successful) throw new Error('execCommand failed');
      } catch (fallbackErr) {
        console.error('Copy failed', fallbackErr);
        alert('Не удалось скопировать. Браузер заблокировал доступ к буферу обмена.');
        return;
      }
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Форматирование времени в HH:mm:ss
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const sidebar = (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">1. Источник</label>
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 p-6 text-center transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="text-sm font-medium">
            {files.length > 0 ? `Найдено: ${files.length}` : 'Выбрать папку'}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            // @ts-expect-error webkitdirectory is non-standard but supported
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleDirectorySelect}
          />
        </div>
        <p className="px-1 text-[10px] leading-tight text-zinc-400">
          Браузер не отслеживает изменения на диске. Чтобы обновить файлы, выберите папку снова.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">2. Настройки</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handlePresetChange(key)}
              className={`rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedPreset === key
                  ? 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
              }`}
            >
              {PRESETS[key].name}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-xs text-zinc-500">Контент (расширения)</span>
            <input
              type="text"
              value={customExtensions}
              onChange={(e) => setCustomExtensions(e.target.value)}
              className="w-full rounded border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <span className="mb-1 block text-xs text-zinc-500">Игнорировать</span>
            <input
              type="text"
              value={customIgnore}
              onChange={(e) => setCustomIgnore(e.target.value)}
              className="w-full rounded border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <Switch label="Дерево файлов" checked={includeTree} onCheckedChange={setIncludeTree} />
        </div>
      </div>

      <button
        onClick={processFiles}
        disabled={files.length === 0 || processing}
        className={`w-full rounded-lg py-3 font-bold text-white shadow-sm transition-all ${
          files.length === 0 ? 'bg-zinc-300 dark:bg-zinc-700' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {processing ? `Обработка ${progress}%...` : 'Сгенерировать'}
      </button>

      {/* --- STATS BLOCK --- */}
      {stats && (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          {/* Main Token Count */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="mb-1 text-xs font-bold tracking-wide text-blue-600 uppercase dark:text-blue-300">
              Токены (Est.)
            </div>
            <div className="font-mono text-2xl font-bold text-blue-700 dark:text-blue-200">
              ~{stats.estimatedTokens.toLocaleString()}
            </div>
            <div className="mt-1 text-[10px] text-blue-500">
              {((stats.estimatedTokens / 1_000_000) * 100).toFixed(1)}% от контекста 1M
            </div>
          </div>

          {/* Efficiency Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800">
              <div className="text-[10px] font-bold text-zinc-500">Файлы</div>
              <div className="font-mono text-sm">
                {stats.processedFiles} <span className="text-zinc-400">/ {stats.totalFiles}</span>
              </div>
            </div>
            <div className="rounded border border-green-100 bg-green-50 p-2 dark:border-green-800 dark:bg-green-900/20">
              <div className="text-[10px] font-bold text-green-600 dark:text-green-400">Сжатие</div>
              <div className="font-mono text-sm text-green-700 dark:text-green-300">
                -{stats.savings.percentage.toFixed(0)}%
              </div>
            </div>
          </div>

          {/* Top Heaviest Files */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-zinc-500 uppercase">Самые тяжелые файлы</div>
            <div className="space-y-1">
              {stats.topFiles.map((f, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded bg-zinc-50 px-2 py-1 font-mono text-[10px] dark:bg-zinc-800/50"
                >
                  <span className="max-w-[140px] truncate" title={f.path}>
                    {f.path.split('/').pop()}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">~{f.tokens.toLocaleString()}t</span>
                    <span className="w-10 text-right text-zinc-400">{formatBytes(f.size)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout title="Project to LLM Context" sidebar={sidebar}>
      <div className="relative flex h-full w-full flex-col overflow-hidden bg-zinc-50 p-4 dark:bg-black/20">
        {result ? (
          <Card
            className="flex h-full flex-1 flex-col shadow-sm"
            title={
              <div className="flex items-center gap-3">
                <span>Результат</span>
                {lastGeneratedAt && (
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-normal text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    Обновлено: {formatTime(lastGeneratedAt)}
                  </span>
                )}
              </div>
            }
            contentClassName="p-0 flex-1 overflow-hidden flex flex-col"
            headerActions={
              <div className="flex gap-2">
                <button
                  onClick={copyToClipboard}
                  className={`rounded px-3 py-1.5 text-xs transition-all duration-200 ${
                    copied
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700'
                  }`}
                >
                  {copied ? 'Скопировано!' : 'Копировать'}
                </button>
                <button
                  onClick={downloadResult}
                  className="rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  Скачать .txt
                </button>
              </div>
            }
          >
            <div className="flex-1 overflow-y-auto bg-white p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
              {result}
            </div>
          </Card>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center text-zinc-400">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
              <span className="text-2xl">🤖</span>
            </div>
            <p>
              {processing
                ? 'Обработка и генерация контекста...'
                : 'Генератор контекста для LLM (Ultra Optimized for Gemini)'}
            </p>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
