'use client';

import Link from 'next/link';
import React, { useCallback, useRef, useState } from 'react';

import {
  calculateFileScore,
  processFileToContext,
  type RawFile,
} from '@/lib/modules/context-generator/assembly';
import {
  generateContextOutput,
  type ProcessedContextFile,
} from '@/lib/modules/context-generator/core';
import {
  CONTEXT_PRESETS,
  LOCAL_CONTEXT_FOLDER,
  type PresetKey,
} from '@/lib/modules/context-generator/rules';
import { isTextFile, LANGUAGE_MAP } from '@/lib/modules/file-system/analyzers';
import { createIgnoreManager } from '@/lib/modules/file-system/scanner';
import { formatBytes, generateAsciiTree } from '@/lib/modules/file-system/topology';
import { Card } from '@/view/ui/Card';
import { Switch } from '@/view/ui/Switch';
import { Workbench } from '@/view/ui/Workbench';

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

const readFileAsText = (file: File): Promise<string> => file.text();

// --- COMPONENT ---

export function ProjectToContext() {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('nextjs');
  const [customExtensions, setCustomExtensions] = useState<string>(
    CONTEXT_PRESETS.nextjs.textExtensions.join(', ')
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

  const handlePresetChange = (key: PresetKey) => {
    setSelectedPreset(key);
    setCustomExtensions(CONTEXT_PRESETS[key].textExtensions.join(', '));
    setCustomIgnore('');
  };

  /**
   * [REFINED] Обработка выбора директории с использованием централизованного сканера.
   */
  const handleDirectorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileList = Array.from(e.target.files);

    // 1. Поиск .gitignore для настройки менеджера игнорирования
    const gitIgnoreFile = fileList.find((f) => f.name === '.gitignore');
    let gitIgnoreContent: string | null = null;
    if (gitIgnoreFile) {
      try {
        gitIgnoreContent = await readFileAsText(gitIgnoreFile);
      } catch (err) {
        console.warn('⚠️ Не удалось прочитать .gitignore', err);
      }
    }

    // 2. Эвристическое определение пресета
    let detectedPreset: PresetKey | null = null;
    const fileNames = fileList.map((f) => f.name);
    if (fileNames.includes('project.godot')) {
      detectedPreset = 'godot';
    } else if (fileNames.includes('package.json') || fileNames.includes('next.config.ts')) {
      detectedPreset = 'nextjs';
    }

    const activePresetKey = detectedPreset || selectedPreset;
    const activePreset = CONTEXT_PRESETS[activePresetKey];

    if (detectedPreset && detectedPreset !== selectedPreset) {
      setSelectedPreset(detectedPreset);
      setCustomExtensions(activePreset.textExtensions.join(', '));
    }

    // 3. Создание менеджера игнорирования через новый модуль
    const customPatterns = customIgnore
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const ig = createIgnoreManager({
      gitIgnoreContent,
      ignorePatterns: [...activePreset.hardIgnore, ...customPatterns],
    });

    const nodes: FileNode[] = [];
    const extList = customExtensions.split(',').map((s) => s.trim().toLowerCase());

    for (const f of fileList) {
      let path = f.webkitRelativePath || f.name;
      const parts = path.split('/');
      if (parts.length > 1) path = parts.slice(1).join('/');

      // ТЕПЕРЬ ЭТО БЕЗОПАСНО: .ai/.git будет отсечен внутри ig.ignores
      if (ig.ignores(path)) continue;

      const isLocalContext = path.startsWith(LOCAL_CONTEXT_FOLDER + '/');
      nodes.push({
        path,
        name: f.name,
        size: f.size,
        file: f,
        isText: isTextFile(f.name, extList) || isLocalContext,
      });
    }

    setFiles(nodes);
    setResult(null);

    // ВМЕСТО useEffect: Запускаем обработку немедленно с новыми данными
    if (nodes.length > 0) {
      void processFiles(nodes);
    }
  };

  // 1. Обновляем processFiles, чтобы он мог принимать файлы напрямую
  const processFiles = useCallback(
    async (filesToProcess?: FileNode[]) => {
      const targetFiles = filesToProcess || files; // Используем переданные файлы или стейт
      if (targetFiles.length === 0) return;

      setProcessing(true);
      setProgress(0);
      setResult(null);

      // Сортировка по важности (Score)
      const sortedFiles = [...files].sort((a, b) => {
        return (
          calculateFileScore(a.name, undefined, a.path) -
          calculateFileScore(b.name, undefined, b.path)
        );
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
          const rawFile: RawFile = {
            name: node.name,
            path: node.path,
            content: originalText,
            extension: ext,
          };

          const contextNode = processFileToContext(rawFile);

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
          console.error(`❌ Ошибка обработки ${node.path}`, e);
        }

        processedCount++;
        // Неблокирующее обновление прогресса
        if (processedCount % 10 === 0 || processedCount === sortedFiles.length) {
          setProgress(Math.round((processedCount / sortedFiles.length) * 100));
          await new Promise((r) => requestAnimationFrame(r));
        }
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
      setProcessing(false);
    },
    [files, includeTree]
  );

  const copyToClipboard = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Ошибка при копировании в буфер обмена.');
    }
  };

  const downloadResult = () => {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'project_context.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const sidebar = (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          На главную
        </Link>
        <h2 className="text-xl font-bold">Project to Context</h2>
      </div>

      {/* 1. ИСТОЧНИК */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">1. Источник</label>
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 p-6 text-center transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="text-sm font-medium">
            {files.length > 0 ? `Найдено файлов: ${files.length}` : 'Выбрать папку проекта'}
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
      </div>

      {/* 2. НАСТРОЙКИ */}
      <div className="flex flex-col gap-4">
        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
          2. Конфигурация
        </label>
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
            <span className="mb-1 block text-[10px] font-bold text-zinc-500 uppercase">
              Расширения
            </span>
            <input
              type="text"
              value={customExtensions}
              onChange={(e) => setCustomExtensions(e.target.value)}
              className="w-full rounded border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <span className="mb-1 block text-[10px] font-bold text-zinc-500 uppercase">
              Игнорировать
            </span>
            <input
              type="text"
              value={customIgnore}
              onChange={(e) => setCustomIgnore(e.target.value)}
              placeholder="*.log, temp/"
              className="w-full rounded border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <Switch
            label="Генерировать дерево"
            checked={includeTree}
            onCheckedChange={setIncludeTree}
          />
        </div>
      </div>

      <button
        onClick={() => void processFiles()} // Change: wrap in arrow function
        disabled={files.length === 0 || processing}
        className={`w-full rounded-lg py-3 font-bold text-white shadow-sm transition-all ${
          files.length === 0 ? 'bg-zinc-300 dark:bg-zinc-700' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {processing ? `Обработка ${progress}%...` : 'Сгенерировать'}
      </button>

      {/* 3. СТАТИСТИКА */}
      {stats && (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="mb-1 text-[10px] font-bold text-blue-600 uppercase dark:text-blue-300">
              Токены (Est.)
            </div>
            <div className="font-mono text-2xl font-bold text-blue-700 dark:text-blue-200">
              ~{stats.estimatedTokens.toLocaleString()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800">
              <div className="text-[10px] font-bold text-zinc-500 uppercase">Файлы</div>
              <div className="font-mono text-sm">
                {stats.processedFiles} / {stats.totalFiles}
              </div>
            </div>
            <div className="rounded border border-green-100 bg-green-50 p-2 dark:border-green-800 dark:bg-green-900/20">
              <div className="text-[10px] font-bold text-green-600 uppercase">Сжатие</div>
              <div className="font-mono text-sm text-green-700">
                -{stats.savings.percentage.toFixed(0)}%
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-bold text-zinc-500 uppercase">Топ тяжелых файлов</div>
            {stats.topFiles.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded bg-zinc-50 px-2 py-1 font-mono text-[10px] dark:bg-zinc-800/50"
              >
                <span className="max-w-[140px] truncate">{f.path.split('/').pop()}</span>
                <span className="text-zinc-400">{formatBytes(f.size)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <Workbench.Root>
      <Workbench.Sidebar>{sidebar}</Workbench.Sidebar>
      <Workbench.Stage>
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-zinc-50 p-4 dark:bg-black/20">
          {result ? (
            <Card
              className="flex h-full flex-1 flex-col shadow-sm"
              title={
                <div className="flex items-center gap-3">
                  <span>Результат контекста</span>
                  {lastGeneratedAt && (
                    <span className="text-[10px] font-normal text-zinc-400">
                      {lastGeneratedAt.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              }
              contentClassName="p-0 flex-1 overflow-hidden flex flex-col"
              headerActions={
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className={`rounded px-3 py-1.5 text-xs transition-all ${
                      copied ? 'bg-green-100 text-green-700' : 'bg-zinc-100 hover:bg-zinc-200'
                    }`}
                  >
                    {copied ? 'Готово!' : 'Копировать'}
                  </button>
                  <button
                    onClick={downloadResult}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    Скачать .txt
                  </button>
                </div>
              }
            >
              <div className="flex-1 overflow-y-auto bg-white p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                {result}
              </div>
            </Card>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-zinc-400">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <span className="text-2xl">🤖</span>
              </div>
              <p className="text-sm">
                {processing
                  ? 'Выполняется генерация...'
                  : 'Выберите папку проекта для создания контекста'}
              </p>
            </div>
          )}
        </div>
      </Workbench.Stage>
    </Workbench.Root>
  );
}
