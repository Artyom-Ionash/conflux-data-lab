'use client';

import ignore from 'ignore';
import React, { useCallback, useEffect, useRef, useState } from 'react';

// --- SHARED LOGIC IMPORTS ---
import { CONTEXT_PRESETS, type PresetKey } from '@/lib/modules/context-generator/config';
import {
  generateContextOutput,
  type ProcessedContextFile,
} from '@/lib/modules/context-generator/core';
import {
  calculateFileScore,
  processFileToContext,
  type RawFile,
} from '@/lib/modules/context-generator/pipeline';
// --- UTILS ---
import { isTextFile, LANGUAGE_MAP } from '@/lib/modules/file-system/file-utils';
import { formatBytes, generateAsciiTree } from '@/lib/modules/file-system/tree-view';

// --- UI COMPONENTS ---
import { Card } from '../../primitives/Card';
import { Switch } from '../../primitives/Switch';
import { ToolLayout } from '../ToolLayout';

// --- TYPES ---

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

const readFileAsText = (file: File): Promise<string> => {
  return file.text();
};

// --- COMPONENT ---

export function ProjectToContext() {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('godot');
  const [customExtensions, setCustomExtensions] = useState<string>(
    CONTEXT_PRESETS.godot.textExtensions.join(', ')
  );
  const [customIgnore, setCustomIgnore] = useState<string>('');
  const [includeTree, setIncludeTree] = useState(true);

  const [files, setFiles] = useState<FileNode[]>([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- HANDLERS ---

  const handlePresetChange = (key: PresetKey) => {
    setSelectedPreset(key);
    setCustomExtensions(CONTEXT_PRESETS[key].textExtensions.join(', '));
    setCustomIgnore('');
  };

  const handleDirectorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileList = [...e.target.files];

    // 1. Поиск .gitignore
    const gitIgnoreFile = fileList.find((f) => f.name === '.gitignore');
    let gitIgnoreContent = '';

    if (gitIgnoreFile) {
      try {
        gitIgnoreContent = await readFileAsText(gitIgnoreFile);
      } catch (err) {
        console.warn('Failed to read .gitignore', err);
      }
    }

    // 2. Определение пресета
    let detectedPreset: PresetKey | null = null;
    const fileNames = fileList.map((f) => f.name);

    if (fileNames.includes('project.godot')) {
      detectedPreset = 'godot';
    } else if (
      fileNames.includes('next.config.js') ||
      fileNames.includes('next.config.ts') ||
      fileNames.includes('package.json')
    ) {
      detectedPreset = 'nextjs';
    }

    const activePresetKey = detectedPreset || selectedPreset;
    const activePreset = CONTEXT_PRESETS[activePresetKey];

    if (detectedPreset && detectedPreset !== selectedPreset) {
      setSelectedPreset(detectedPreset);
      setCustomExtensions(activePreset.textExtensions.join(', '));
      setCustomIgnore('');
    }

    // 3. Настройка Ignore Manager
    const ig = ignore();

    // А) Добавляем Hard Ignore из пресета
    ig.add(activePreset.hardIgnore);

    // Б) Добавляем правила из .gitignore (если есть)
    if (gitIgnoreContent) {
      ig.add(gitIgnoreContent);
    }

    // В) Добавляем пользовательские правила из UI инпута
    if (customIgnore.trim()) {
      ig.add(
        customIgnore
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      );
    }

    // Расширения
    const extList = activePreset.textExtensions;

    // 4. Фильтрация
    const nodes: FileNode[] = [];

    fileList.forEach((f) => {
      // Нормализация пути: убираем имя корневой папки, которую дает браузер
      let path = f.webkitRelativePath || f.name;
      if (f.webkitRelativePath) {
        const parts = path.split('/');
        // Если путь содержит папку проекта (что почти всегда так при выборе папки), убираем её
        if (parts.length > 1) {
          path = parts.slice(1).join('/');
        }
      }

      // ПРОВЕРКА ЧЕРЕЗ ПАКЕТ IGNORE
      if (ig.ignores(path)) return;

      nodes.push({
        path: path,
        name: f.name,
        size: f.size,
        file: f,
        isText: isTextFile(f.name, extList),
      });
    });

    setFiles(nodes);
    setResult(null);
    setStats(null);
  };

  const processFiles = useCallback(async () => {
    setProcessing(true);
    setProgress(0);
    setResult(null);

    // Сортировка для последовательной обработки (опционально, т.к. pipeline чистый)
    const sortedFiles = [...files].sort((a, b) => {
      return calculateFileScore(a.name) - calculateFileScore(b.name);
    });

    let totalOriginalBytes = 0;
    let totalCleanedBytes = 0;
    const composition: Record<string, number> = {};
    const processedFileStats: { path: string; size: number; tokens: number }[] = [];
    const filesForGenerator: ProcessedContextFile[] = [];

    let processedCount = 0;

    for (const node of sortedFiles) {
      if (!node.isText) {
        processedCount++;
        continue;
      }

      try {
        const originalText = await readFileAsText(node.file);
        const ext = node.name.split('.').pop() || 'txt';

        // --- ПРИМЕНЕНИЕ ПАЙПЛАЙНА ---
        const rawFile: RawFile = {
          name: node.name,
          path: node.path,
          content: originalText,
          extension: ext,
        };

        const contextNode = processFileToContext(rawFile);
        // -----------------------------

        totalOriginalBytes += contextNode.originalSize;
        totalCleanedBytes += contextNode.cleanedSize;

        let reportLang = LANGUAGE_MAP[contextNode.langTag] || contextNode.langTag;
        if (node.name.includes('config') || node.name.startsWith('.')) reportLang = 'config/meta';
        composition[reportLang] = (composition[reportLang] || 0) + 1;

        filesForGenerator.push({
          path: contextNode.path,
          content: contextNode.content,
          langTag: contextNode.langTag,
          size: contextNode.cleanedSize,
        });

        processedFileStats.push({
          path: contextNode.path,
          size: contextNode.cleanedSize,
          tokens: Math.ceil(contextNode.cleanedSize / 4),
        });
      } catch (e) {
        console.error(`Error processing ${node.path}`, e);
      }

      processedCount++;
      setProgress(Math.round((processedCount / sortedFiles.length) * 80));
      if (processedCount % 5 === 0) await new Promise((r) => setTimeout(r, 0));
    }

    const treeString = includeTree ? generateAsciiTree(sortedFiles) : '';
    const { output, stats: coreStats } = generateContextOutput(filesForGenerator, treeString);

    const savingsBytes = totalOriginalBytes - totalCleanedBytes;
    const savingsPercent = totalOriginalBytes > 0 ? (savingsBytes / totalOriginalBytes) * 100 : 0;
    const topFiles = processedFileStats.sort((a, b) => b.size - a.size).slice(0, 5);

    setStats({
      totalFiles: sortedFiles.length,
      processedFiles: filesForGenerator.length,
      totalChars: totalCleanedBytes,
      estimatedTokens: coreStats.totalTokens,
      originalSize: totalOriginalBytes,
      cleanedSize: totalCleanedBytes,
      savings: { bytes: savingsBytes, percentage: savingsPercent },
      composition,
      topFiles,
    });

    setResult(output);
    setLastGeneratedAt(new Date());
    setProgress(100);
    setProcessing(false);
  }, [files, includeTree]);

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
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(result);
      } else {
        throw new Error('Clipboard API unavailable');
      }
    } catch {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = result;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (fallbackErr) {
        console.error('Copy failed', fallbackErr);
        alert('Не удалось скопировать.');
        return;
      }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
            // @ts-expect-error webkitdirectory is non-standard
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleDirectorySelect}
          />
        </div>
        <p className="px-1 text-[10px] leading-tight text-zinc-400">
          Выберите папку корневого проекта.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">2. Настройки</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CONTEXT_PRESETS) as PresetKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handlePresetChange(key)}
              className={`rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedPreset === key
                  ? 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
              }`}
            >
              {CONTEXT_PRESETS[key].name}
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
            <span className="mb-1 block text-xs text-zinc-500">
              Дополнительно игнорировать (поверх .gitignore)
            </span>
            <input
              type="text"
              value={customIgnore}
              onChange={(e) => setCustomIgnore(e.target.value)}
              placeholder="*.log, temp/"
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
                : 'Генератор контекста для LLM (Ultra Optimized)'}
            </p>
          </div>
        )}
      </div>
    </ToolLayout>
  );
}
