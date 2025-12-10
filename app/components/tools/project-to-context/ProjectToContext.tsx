"use client";

import React, { useRef,useState } from "react";

import { Card } from "../../ui/Card";
import { Switch } from "../../ui/Switch";
import { ToolLayout } from "../ToolLayout";

// --- CONFIGURATION ---

const PRESETS = {
  godot: {
    name: "Godot 4 (Logic Only)",
    // Файлы, содержимое которых мы ХОТИМ читать
    textExtensions: [".gd", ".tscn", ".godot", ".tres", ".cfg", ".gdshader", ".json", ".txt", ".md", ".py"],
    // Папки и файлы, которые мы вообще НЕ ХОТИМ видеть (даже в дереве)
    hardIgnore: [
      ".git", ".godot", ".import", "builds", "__pycache__", "node_modules", 
      ".next", ".vscode", ".idea", "*.uid", "*.import" 
    ]
  },
  nextjs: {
    name: "Next.js / React",
    textExtensions: [".ts", ".tsx", ".js", ".jsx", ".css", ".scss", ".json", ".md", ".env.example"],
    hardIgnore: [".git", "node_modules", ".next", "dist", "build", "coverage", "package-lock.json", "yarn.lock"]
  }
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

function isTextFile(filename: string, extensions: string[]): boolean {
  const lowerName = filename.toLowerCase();
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

function preprocessContent(content: string, extension: string): string {
  let cleaned = content;

  if (extension === 'tscn' || extension === 'tres') {
    
    // 1. УДАЛЕНИЕ "ШУМНЫХ" ПОД-РЕСУРСОВ
    // Полностью вырезаем блоки текстур, шейпов, шрифтов и прочего.
    const noiseTypes = [
      'AtlasTexture', 'StyleBoxTexture', 'StyleBoxFlat', 'Theme', 
      'TileSetAtlasSource', 'BitMap', 'Gradient', 'GradientTexture1D', 
      'FastNoiseLite', 'NoiseTexture2D', 'CapsuleShape2D', 'CircleShape2D', 
      'RectangleShape2D', 'BoxShape3D', 'SphereShape3D', 'FontVariation',
      'SpriteFrames' // SpriteFrames тоже удаляем, так как это просто список картинок
    ].join("|");
    
    const noiseRegex = new RegExp(`\\[sub_resource type="(${noiseTypes})"[\\s\\S]*?(?=\\n\\[|$)`, 'g');
    cleaned = cleaned.replace(noiseRegex, "");

    // 2. ОЧИСТКА ВНЕШНИХ РЕСУРСОВ (ExtResource)
    // Если ресурс - это картинка или звук, удаляем строку. Оставляем только скрипты (.gd) и сцены (.tscn).
    // Пример: [ext_resource type="Texture2D" path="res://icon.png" id="1_..."] -> Удалить
    cleaned = cleaned.replace(/^\[ext_resource.*path=".*\.(png|jpg|jpeg|webp|svg|mp3|wav|ogg|ttf|otf)".*\]$/gm, "");

    // 3. СЖАТИЕ АНИМАЦИЙ
    // Оставляем только заголовок с именем.
    cleaned = cleaned.replace(/(\[sub_resource type="Animation"[^\]]*\])([\s\S]*?)(?=\[|$)/g, (match, header, body) => {
        const nameMatch = body.match(/resource_name\s*=\s*"([^"]+)"/);
        const animName = nameMatch ? nameMatch[1] : "unnamed";
        return `${header}\n; Animation "${animName}" (data stripped)\n`;
    });

    // 4. УДАЛЕНИЕ ТРЕКОВ АНИМАЦИИ (если вдруг они остались вне sub_resource)
    // Удаляем любые строки, начинающиеся с "tracks/"
    cleaned = cleaned.replace(/^tracks\/.*$/gm, "");

    // 5. ОЧИСТКА МАССИВОВ ДАННЫХ
    const arrayRegex = /\b(PackedByteArray|PackedVector2Array|PackedInt32Array|PackedFloat32Array|PackedStringArray|PackedColorArray)\s*\(([^)]*)\)/g;
    cleaned = cleaned.replace(arrayRegex, '$1(...)');

    // 6. ОЧИСТКА СВОЙСТВ УЗЛОВ (Опционально, но полезно)
    // Удаляем координаты текстур в узлах (например, region_rect)
    cleaned = cleaned.replace(/^region_rect = .*$/gm, "");

    // 7. УДАЛЕНИЕ ПУСТЫХ СТРОК (сжимаем файл)
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  }

  if (extension === 'godot') {
    // Упрощаем Input Map
    cleaned = cleaned.replace(/Object\((InputEvent[^,]+),[^)]+\)/g, "$1(...)");
    cleaned = cleaned.replace(/"events": \[\]/g, "");
    // Удаляем пустые секции
    cleaned = cleaned.replace(/\n\n\[/g, "\n["); 
  }
  
  return cleaned;
}

// --- LOGIC: TREE GENERATION ---

// Recursive type to handle the tree structure without 'any'
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
        // Cast is necessary here because current[part] could theoretically be a primitive based on the type definition,
        // but our logic ensures it's a node.
        current = current[part] as FileSystemNode;
      }
    });
  });

  let output = "";
  
  function traverse(node: FileSystemNode, depth: number) {
    const keys = Object.keys(node).sort((a, b) => {
      // Use type assertion or optional chaining that assumes object structure for sorting
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
        // We know size exists if _is_file is true based on our generation logic
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
  const [stats, setStats] = useState<{files: number, textFiles: number, chars: number} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePresetChange = (key: PresetKey) => {
    setSelectedPreset(key);
    setCustomExtensions(PRESETS[key].textExtensions.join(", "));
    setCustomIgnore(PRESETS[key].hardIgnore.join(", "));
  };

  const handleDirectorySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileList = Array.from(e.target.files);
    
    const ignoreList = customIgnore.split(",").map(s => s.trim()).filter(s => s.length > 0);
    const extList = customExtensions.split(",").map(s => s.trim()).filter(s => s.length > 0);

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

    let output = "# Project Context\n\n";
    
    if (includeTree) {
      output += "## Project Structure\n\n```text\n";
      output += generateTree(sortedFiles);
      output += "```\n\n";
    }

    output += "## File Contents\n\n";

    let processedCount = 0;
    let textFileCount = 0;
    
    for (const node of sortedFiles) {
      // ПРОПУСКАЕМ БИНАРНЫЕ ФАЙЛЫ ПОЛНОСТЬЮ
      // Они уже есть в дереве. Дублировать их заголовки в контенте не нужно.
      if (!node.isText) {
        processedCount++;
        continue;
      }

      textFileCount++;
      
      output += `--- START OF FILE: ${node.path} ---\n`;
      try {
        const originalText = await readFileAsText(node.file);
        const ext = node.name.split('.').pop() || "txt";
        const cleanedText = preprocessContent(originalText, ext);
        
        output += "```" + (ext === 'gd' ? 'gdscript' : ext) + "\n";
        output += cleanedText;
        output += "\n```\n\n";
      } catch {
        output += `(Error reading file)\n\n`;
      }
      
      processedCount++;
      setProgress(Math.round((processedCount / sortedFiles.length) * 100));
      if (processedCount % 5 === 0) await new Promise(r => setTimeout(r, 0));
    }

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
    a.download = "project_context.md";
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
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors border ${
                  selectedPreset === key 
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
        className={`w-full py-3 rounded-lg font-bold text-white transition-all shadow-sm ${
          files.length === 0 ? 'bg-zinc-300 dark:bg-zinc-700' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {processing ? `Обработка ${progress}%...` : "Сгенерировать"}
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
             <p>Генератор контекста для LLM (Ultra Optimized)</p>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}