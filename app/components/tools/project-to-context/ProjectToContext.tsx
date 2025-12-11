"use client";

import React, { useRef, useState } from "react";

import { Card } from "../../ui/Card";
import { Switch } from "../../ui/Switch";
import { ToolLayout } from "../ToolLayout";

// --- CONFIGURATION ---

const PRESETS = {
  godot: {
    name: "Godot 4 (Logic Only)",
    textExtensions: [".gd", ".tscn", ".godot", ".tres", ".cfg", ".gdshader", ".json", ".txt", ".md", ".py"],
    hardIgnore: [
      ".git", ".godot", ".import", "builds", "__pycache__", "node_modules",
      ".next", ".vscode", ".idea", "*.uid", "*.import", ".DS_Store"
    ]
  },
  nextjs: {
    name: "Next.js / React",
    textExtensions: [".ts", ".tsx", ".js", ".jsx", ".css", ".scss", ".json", ".md", ".env.example", ".config.js"],
    hardIgnore: [".git", "node_modules", ".next", "dist", "build", "coverage", "package-lock.json", "yarn.lock", "pnpm-lock.yaml", ".DS_Store"]
  }
};

const LANGUAGE_MAP: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  gd: "gdscript",
  shader: "glsl",
  gdshader: "glsl",
  html: "html",
  css: "css",
  scss: "scss",
  json: "json",
  md: "markdown",
  txt: "text",
  godot: "ini",
  tscn: "ini",
  tres: "ini",
  yaml: "yaml",
  yml: "yaml"
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

function formatBytes(bytes: number, decimals = 0) {
  if (!+bytes) return '0B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}${sizes[i]}`;
}

function getLanguageTag(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || "text";
  return LANGUAGE_MAP[ext] || ext;
}

function isTextFile(filename: string, extensions: string[]): boolean {
  const lowerName = filename.toLowerCase();

  if (lowerName === "package-lock.json" || lowerName === "yarn.lock" || lowerName === "pnpm-lock.yaml" || lowerName === "bun.lockb") {
    return false;
  }

  if (lowerName.endsWith("project.godot") || lowerName.endsWith("package.json") || lowerName === "dockerfile") return true;

  return extensions.some(ext => lowerName.endsWith(ext));
}

function shouldIgnore(path: string, ignorePatterns: string[]): boolean {
  const normalizedPath = path.replaceAll('\\', '/');
  const filename = normalizedPath.split('/').pop() || "";

  for (const pattern of ignorePatterns) {
    if (pattern.startsWith("*.")) {
      if (filename.endsWith(pattern.slice(1))) return true;
    } else {
      if (normalizedPath.includes(`/${pattern}/`) || normalizedPath.startsWith(`${pattern}/`) || normalizedPath === pattern) {
        return true;
      }
    }
  }
  return false;
}

function preprocessContent(content: string, extension: string): string {
  let cleaned = content;

  if (extension === 'tscn' || extension === 'tres') {
    const noiseTypes = [
      'AtlasTexture', 'StyleBoxTexture', 'StyleBoxFlat', 'Theme',
      'TileSetAtlasSource', 'BitMap', 'Gradient', 'GradientTexture1D',
      'FastNoiseLite', 'NoiseTexture2D', 'CapsuleShape2D', 'CircleShape2D',
      'RectangleShape2D', 'BoxShape3D', 'SphereShape3D', 'FontVariation',
      'SpriteFrames'
    ].join("|");

    const noiseRegex = new RegExp(`\\[sub_resource type="(${noiseTypes})"[\\s\\S]*?(?=\\n\\[|$)`, 'g');
    cleaned = cleaned.replaceAll(noiseRegex, "");

    cleaned = cleaned.replaceAll(/^\[ext_resource.*path=".*\.(png|jpg|jpeg|webp|svg|mp3|wav|ogg|ttf|otf)".*\]$/gm, "");

    cleaned = cleaned.replaceAll(/(\[sub_resource type="Animation"[^\]]*\])([\s\S]*?)(?=\[|$)/g, (match, header, body) => {
      const nameMatch = body.match(/resource_name\s*=\s*"([^"]+)"/);
      const animName = nameMatch ? nameMatch[1] : "unnamed";
      return `${header}\n; Animation "${animName}" (data stripped)\n`;
    });

    cleaned = cleaned.replaceAll(/^tracks\/.*$/gm, "");

    const arrayRegex = /\b(PackedByteArray|PackedVector2Array|PackedInt32Array|PackedFloat32Array|PackedStringArray|PackedColorArray)\s*\(([^)]*)\)/g;
    cleaned = cleaned.replaceAll(arrayRegex, '$1(...)');

    cleaned = cleaned.replaceAll(/^region_rect = .*$/gm, "");

    cleaned = cleaned.replaceAll(/\n{3,}/g, "\n\n");
  }

  if (extension === 'godot') {
    cleaned = cleaned.replaceAll(/Object\((InputEvent[^,]+),[^)]+\)/g, "$1(...)");
    cleaned = cleaned.replaceAll('"events": []', "");
    cleaned = cleaned.replaceAll('\n\n[', "\n[");
  }

  return cleaned;
}

interface FileSystemNode {
  _is_file?: boolean;
  size?: number;
  isText?: boolean;
  [key: string]: FileSystemNode | boolean | number | undefined;
}

function generateTree(files: FileNode[]): string {
  const root: FileSystemNode = {};

  files.forEach(node => {
    const parts = node.path.split('/');
    let current = root;
    parts.forEach((part, index) => {
      if (index === parts.length - 1) {
        current[part] = { _is_file: true, size: node.size, isText: node.isText };
      } else {
        if (!current[part]) current[part] = {};
        current = current[part] as FileSystemNode;
      }
    });
  });

  let output = "";
  function traverse(node: FileSystemNode, depth: number) {
    const keys = Object.keys(node);
     
    keys.sort((a, b) => {
      const nodeA = node[a] as FileSystemNode | undefined;
      const nodeB = node[b] as FileSystemNode | undefined;
      const aIsFile = nodeA?._is_file;
      const bIsFile = nodeB?._is_file;
      if (!aIsFile && bIsFile) return -1;
      if (aIsFile && !bIsFile) return 1;
      return a.localeCompare(b);
    });

    keys.forEach(key => {
      if (key === '_is_file' || key === 'size' || key === 'isText') return;
      const item = node[key] as FileSystemNode;
      const indent = "  ".repeat(depth);
      if (item._is_file) {
        output += `${indent}${key} (${formatBytes(item.size as number)})\n`;
      } else {
        output += `${indent}${key}/\n`;
        traverse(item, depth + 1);
      }
    });
  }
  traverse(root, 0);
  return output;
}

// FIX: Вынесенная функция для unicorn/consistent-function-scoping
// FIX: Используем file.text() вместо FileReader (unicorn/prefer-blob-reading-methods)
const readFileAsText = (file: File): Promise<string> => {
  return file.text();
};

// FIX: Вынесенная функция скоринга
const calculateFileScore = (name: string) => {
  if (name === 'project.godot' || name === 'package.json') return 0;
  if (name.endsWith('.gd') || name.endsWith('.ts') || name.endsWith('.js') || name.endsWith('.py')) return 1;
  if (name.endsWith('.tscn') || name.endsWith('.tsx')) return 2;
  return 3;
};

// --- COMPONENT ---

export function ProjectToContext() {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>("godot");
  const [customExtensions, setCustomExtensions] = useState<string>(PRESETS.godot.textExtensions.join(", "));
  const [customIgnore, setCustomIgnore] = useState<string>(PRESETS.godot.hardIgnore.join(", "));
  const [includeTree, setIncludeTree] = useState(true);

  const [files, setFiles] = useState<FileNode[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);

  const [stats, setStats] = useState<ProjectStats | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePresetChange = (key: PresetKey) => {
    setSelectedPreset(key);
    setCustomExtensions(PRESETS[key].textExtensions.join(", "));
    setCustomIgnore(PRESETS[key].hardIgnore.join(", "));
  };

  const handleDirectorySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileList = [...e.target.files];

    let detectedPreset: PresetKey | null = null;
    const fileNames = fileList.map(f => f.name);

    if (fileNames.includes("project.godot")) {
      detectedPreset = "godot";
    } else if (fileNames.includes("next.config.js") || fileNames.includes("next.config.ts") || fileNames.includes("package.json")) {
      detectedPreset = "nextjs";
    }

    let activeIgnoreStr = customIgnore;
    let activeExtStr = customExtensions;

    if (detectedPreset && detectedPreset !== selectedPreset) {
      const preset = PRESETS[detectedPreset];
      setSelectedPreset(detectedPreset);
      setCustomExtensions(preset.textExtensions.join(", "));
      setCustomIgnore(preset.hardIgnore.join(", "));
      activeExtStr = preset.textExtensions.join(", ");
      activeIgnoreStr = preset.hardIgnore.join(", ");
    }

    const ignoreList = activeIgnoreStr.split(",").map(s => s.trim()).filter(s => s.length > 0);
    const extList = activeExtStr.split(",").map(s => s.trim()).filter(s => s.length > 0);

    const nodes: FileNode[] = [];
    fileList.forEach(f => {
      const path = f.webkitRelativePath || f.name;
      if (shouldIgnore(path, ignoreList)) return;
      nodes.push({
        path: path,
        name: f.name,
        size: f.size,
        file: f,
        isText: isTextFile(f.name, extList)
      });
    });

    setFiles(nodes);
    setResult(null);
    setStats(null);
  };

  const processFiles = async () => {
    setProcessing(true);
    setProgress(0);
    setResult(null);

    // FIX: Используем вынесенную функцию скоринга
    // eslint-disable-next-line unicorn/no-array-sort
    const sortedFiles = [...files].sort((a, b) => {
      return calculateFileScore(a.name) - calculateFileScore(b.name);
    });

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

        const ext = node.name.split('.').pop() || "txt";
        const cleanedText = preprocessContent(originalText, ext);

        totalCleanedBytes += cleanedText.length;

        const langKey = getLanguageTag(node.name);
        const reportLang = LANGUAGE_MAP[ext] || ext;
        composition[reportLang] = (composition[reportLang] || 0) + 1;

        processedFilesData.push({
          node,
          content: cleanedText,
          langTag: langKey
        });

        processedFileStats.push({
          path: node.path,
          size: cleanedText.length,
          tokens: Math.ceil(cleanedText.length / 4)
        });

      } catch (e) {
        console.error(`Error processing ${node.path}`, e);
      }

      processedCount++;
      setProgress(Math.round((processedCount / sortedFiles.length) * 50));
      if (processedCount % 10 === 0) await new Promise(r => setTimeout(r, 0));
    }

    const estimatedTokens = Math.ceil(totalCleanedBytes / 4);
    const savingsBytes = totalOriginalBytes - totalCleanedBytes;
    const savingsPercent = totalOriginalBytes > 0 ? (savingsBytes / totalOriginalBytes) * 100 : 0;

    // eslint-disable-next-line unicorn/no-array-sort
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
      topFiles
    });

    let output = `<codebase_context>
<instruction>
The following is a flattened representation of a project codebase.
1. Use the <directory_structure> to understand the file hierarchy.
2. Content is in <source_files>, where each file is wrapped in a <file> tag.
3. Code blocks utilize standard Markdown triple backticks with language tags (e.g., \`\`\`python) for expert routing.
4. METRICS: Approximately ${estimatedTokens.toLocaleString()} tokens across ${processedFilesData.length} files.
</instruction>

<project_metrics>
  <token_count_estimate>${estimatedTokens}</token_count_estimate>
  <file_count>${processedFilesData.length}</file_count>
  <top_languages>
    ${Object.entries(composition)
        // eslint-disable-next-line unicorn/no-array-sort
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([lang, count]) => `${lang} (${count})`)
        .join(", ")}
  </top_languages>
</project_metrics>

`;

    if (includeTree) {
      output += `<directory_structure>\n\`\`\`text\n${generateTree(sortedFiles)}\n\`\`\`\n</directory_structure>\n\n`;
    }

    output += `<source_files>\n\n`;

    processedFilesData.forEach((item, idx) => {
      output += `<file path="${item.node.path}">\n`;
      output += "```" + item.langTag + "\n";
      output += item.content;
      output += "\n```\n";
      output += `</file>\n\n`;

      if (idx % 10 === 0) setProgress(50 + Math.round((idx / processedFilesData.length) * 50));
    });

    output += `</source_files>\n</codebase_context>`;

    setResult(output);
    setProcessing(false);
  };

  const downloadResult = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gemini_context.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    alert("Copied to clipboard!");
  };

  const sidebar = (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">1. Источник</label>
        <div
          className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="text-sm font-medium">
            {files.length > 0 ? `Найдено: ${files.length}` : "Выбрать папку"}
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
      </div>

      <div className="flex flex-col gap-4">
        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">2. Настройки</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PRESETS) as PresetKey[]).map(key => (
            <button
              key={key}
              onClick={() => handlePresetChange(key)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${selectedPreset === key
                ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400'
                }`}
            >
              {PRESETS[key].name}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <span className="text-xs text-zinc-500 mb-1 block">Контент (расширения)</span>
            <input
              type="text"
              value={customExtensions}
              onChange={(e) => setCustomExtensions(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded font-mono"
            />
          </div>
          <div>
            <span className="text-xs text-zinc-500 mb-1 block">Игнорировать</span>
            <input
              type="text"
              value={customIgnore}
              onChange={(e) => setCustomIgnore(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded font-mono"
            />
          </div>
          <Switch label="Дерево файлов" checked={includeTree} onCheckedChange={setIncludeTree} />
        </div>
      </div>

      <button
        onClick={processFiles}
        disabled={files.length === 0 || processing}
        className={`w-full py-3 rounded-lg font-bold text-white transition-all shadow-sm ${files.length === 0 ? 'bg-zinc-300 dark:bg-zinc-700' : 'bg-blue-600 hover:bg-blue-700'
          }`}
      >
        {processing ? `Обработка ${progress}%...` : "Сгенерировать"}
      </button>

      {/* --- STATS BLOCK --- */}
      {stats && (
        <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800 animate-in fade-in slide-in-from-bottom-2">

          {/* Main Token Count */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800">
            <div className="text-xs text-blue-600 dark:text-blue-300 font-bold uppercase tracking-wide mb-1">Токены (Est.)</div>
            <div className="text-2xl font-mono font-bold text-blue-700 dark:text-blue-200">
              ~{stats.estimatedTokens.toLocaleString()}
            </div>
            <div className="text-[10px] text-blue-500 mt-1">
              {(stats.estimatedTokens / 1_000_000 * 100).toFixed(1)}% от контекста 1M
            </div>
          </div>

          {/* Efficiency Stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-zinc-50 dark:bg-zinc-800 p-2 rounded border border-zinc-200 dark:border-zinc-700">
              <div className="text-[10px] text-zinc-500 font-bold">Файлы</div>
              <div className="text-sm font-mono">{stats.processedFiles} <span className="text-zinc-400">/ {stats.totalFiles}</span></div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-100 dark:border-green-800">
              <div className="text-[10px] text-green-600 dark:text-green-400 font-bold">Сжатие</div>
              <div className="text-sm font-mono text-green-700 dark:text-green-300">-{stats.savings.percentage.toFixed(0)}%</div>
            </div>
          </div>

          {/* Top Heaviest Files */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-zinc-500 uppercase">Самые тяжелые файлы</div>
            <div className="space-y-1">
              {stats.topFiles.map((f, i) => (
                <div key={i} className="flex justify-between items-center text-[10px] font-mono bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded">
                  <span className="truncate max-w-[140px]" title={f.path}>{f.path.split('/').pop()}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">~{(f.tokens).toLocaleString()}t</span>
                    <span className="text-zinc-400 w-10 text-right">{formatBytes(f.size)}</span>
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
      <div className="relative w-full h-full flex flex-col bg-zinc-50 dark:bg-black/20 overflow-hidden p-4">
        {result ? (
          <Card
            className="flex-1 flex flex-col shadow-sm h-full"
            title="Результат"
            contentClassName="p-0 flex-1 overflow-hidden flex flex-col"
            headerActions={
              <div className="flex gap-2">
                <button onClick={copyToClipboard} className="text-xs bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 px-3 py-1.5 rounded transition-colors">Копировать</button>
                <button onClick={downloadResult} className="text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded font-bold shadow-sm">Скачать .txt</button>
              </div>
            }
          >
            <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-zinc-950 font-mono text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
              {result}
            </div>
          </Card>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-400">
            <div className="w-16 h-16 mb-4 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <span className="text-2xl">🤖</span>
            </div>
            <p>Генератор контекста для LLM (Ultra Optimized for Gemini)</p>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}