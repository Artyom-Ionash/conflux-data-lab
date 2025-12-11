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
      ".next", ".vscode", ".idea", "*.uid", "*.import"
    ]
  },
  nextjs: {
    name: "Next.js / React",
    textExtensions: [".ts", ".tsx", ".js", ".jsx", ".css", ".scss", ".json", ".md", ".env.example", ".config.js"],
    hardIgnore: [".git", "node_modules", ".next", "dist", "build", "coverage", "package-lock.json", "yarn.lock"]
  }
};

// Explicit mapping for Gemini's syntax highlighter
const LANGUAGE_MAP: Record<string, string> = {
  js: "javascript",
  jsx: "javascript", // or jsx
  ts: "typescript",
  tsx: "typescript", // or tsx
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
  godot: "ini", // Godot configs look like INI
  tscn: "ini",
  tres: "ini"
};

type PresetKey = keyof typeof PRESETS;

interface FileNode {
  path: string;
  name: string;
  size: number;
  file: File;
  isText: boolean;
}

// --- HELPERS ---

function formatBytes(bytes: number, decimals = 0) {
  if (!+bytes) return '0B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))}${sizes[i]}`;
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
  const normalizedPath = path.replace(/\\/g, '/');
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

// --- LOGIC: AGGRESSIVE PREPROCESSING ---
// Keeps the file size small and removes noise that confuses LLMs

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
    cleaned = cleaned.replace(noiseRegex, "");
    cleaned = cleaned.replace(/^\[ext_resource.*path=".*\.(png|jpg|jpeg|webp|svg|mp3|wav|ogg|ttf|otf)".*\]$/gm, "");
    cleaned = cleaned.replace(/(\[sub_resource type="Animation"[^\]]*\])([\s\S]*?)(?=\[|$)/g, (match, header, body) => {
      const nameMatch = body.match(/resource_name\s*=\s*"([^"]+)"/);
      const animName = nameMatch ? nameMatch[1] : "unnamed";
      return `${header}\n; Animation "${animName}" (data stripped)\n`;
    });
    cleaned = cleaned.replace(/^tracks\/.*$/gm, "");
    const arrayRegex = /\b(PackedByteArray|PackedVector2Array|PackedInt32Array|PackedFloat32Array|PackedStringArray|PackedColorArray)\s*\(([^)]*)\)/g;
    cleaned = cleaned.replace(arrayRegex, '$1(...)');
    cleaned = cleaned.replace(/^region_rect = .*$/gm, "");
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  }

  if (extension === 'godot') {
    cleaned = cleaned.replace(/Object\((InputEvent[^,]+),[^)]+\)/g, "$1(...)");
    cleaned = cleaned.replace(/"events": \[\]/g, "");
    cleaned = cleaned.replace(/\n\n\[/g, "\n[");
  }

  return cleaned;
}

// --- LOGIC: TREE GENERATION ---

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
    const keys = Object.keys(node).sort((a, b) => {
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
  const [stats, setStats] = useState<{ files: number, textFiles: number, chars: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePresetChange = (key: PresetKey) => {
    setSelectedPreset(key);
    setCustomExtensions(PRESETS[key].textExtensions.join(", "));
    setCustomIgnore(PRESETS[key].hardIgnore.join(", "));
  };

  const handleDirectorySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileList = Array.from(e.target.files);

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

  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const processFiles = async () => {
    setProcessing(true);
    setProgress(0);
    setResult(null);

    const sortedFiles = [...files].sort((a, b) => {
      const score = (name: string) => {
        if (name === 'project.godot') return 0;
        if (name.endsWith('.gd')) return 1;
        if (name.endsWith('.py')) return 1;
        if (name.endsWith('.tscn')) return 2;
        return 3;
      };
      return score(a.name) - score(b.name);
    });

    // --- GEMINI-OPTIMIZED HEADER ---
    // Используем XML для структуры и естественный язык для инструкций
    let output = `<codebase_context>
<instruction>
The following is a flattened representation of a project codebase. 
1. Use the <directory_structure> to understand the file hierarchy.
2. Each file is wrapped in a <file> tag with its path attribute.
3. Code blocks utilize standard Markdown triple backticks with language tags for correct syntax highlighting.
</instruction>

`;

    if (includeTree) {
      output += `<directory_structure>
\`\`\`text
${generateTree(sortedFiles)}
\`\`\`
</directory_structure>

`;
    }

    output += `<source_files>\n\n`;

    let processedCount = 0;
    let textFileCount = 0;

    for (const node of sortedFiles) {
      if (!node.isText) {
        processedCount++;
        continue;
      }

      textFileCount++;

      // XML Wrapper for explicit context boundaries
      output += `<file path="${node.path}">\n`;
      try {
        const originalText = await readFileAsText(node.file);
        const ext = node.name.split('.').pop() || "txt";
        const cleanedText = preprocessContent(originalText, ext);
        const langTag = getLanguageTag(node.name);

        // Markdown block for Model's "Code Mode" activation
        output += "```" + langTag + "\n";
        output += cleanedText;
        output += "\n```\n";
      } catch {
        output += `(Error reading file)\n`;
      }
      output += `</file>\n\n`;

      processedCount++;
      setProgress(Math.round((processedCount / sortedFiles.length) * 100));
      if (processedCount % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }

    output += `</source_files>\n</codebase_context>`;

    setResult(output);
    setStats({
      files: sortedFiles.length,
      textFiles: textFileCount,
      chars: output.length
    });
    setProcessing(false);
  };

  const downloadResult = () => {
    if (!result) return;
    const blob = new Blob([result], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "gemini_context.md"; // Updated filename
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
        {processing ? `Обработка ${progress}%...` : "Сгенерировать Context"}
      </button>

      {stats && (
        <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <div className="text-xs text-zinc-500 flex justify-between">
            <span>Всего файлов:</span> <span className="font-mono">{stats.files}</span>
          </div>
          <div className="text-xs text-zinc-500 flex justify-between">
            <span>Включено в контент:</span> <span className="font-mono">{stats.textFiles}</span>
          </div>
          <div className="text-xs text-zinc-500 flex justify-between">
            <span>Размер контекста:</span> <span className="font-mono">{formatBytes(stats.chars)}</span>
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
                <button onClick={downloadResult} className="text-xs bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded font-bold shadow-sm">Скачать .md</button>
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