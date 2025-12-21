'use client';

import Link from 'next/link';
import React, { useCallback, useRef, useState } from 'react';

import { type ContextStats } from '@/lib/modules/context-generator/core';
import { runContextPipeline } from '@/lib/modules/context-generator/engine';
import {
  CONTEXT_PRESETS,
  LOCAL_CONTEXT_FOLDER,
  type PresetKey,
} from '@/lib/modules/context-generator/rules';
import { isTextFile } from '@/lib/modules/file-system/analyzers';
import { createIgnoreManager } from '@/lib/modules/file-system/scanner';
import { Card } from '@/view/ui/Card';
import { cn } from '@/view/ui/infrastructure/standards';
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

// --- COMPONENT ---

export function ProjectToContext() {
  // --- Configuration State ---
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('nextjs');
  const [customExtensions, setCustomExtensions] = useState<string>(
    CONTEXT_PRESETS.nextjs.textExtensions.join(', ')
  );
  const [customIgnore, setCustomIgnore] = useState<string>('');
  const [includeTree, setIncludeTree] = useState(true);

  // --- Processing State ---
  const [files, setFiles] = useState<FileNode[]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [stats, setStats] = useState<ContextStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Logic ---

  const handlePresetChange = (key: PresetKey) => {
    setSelectedPreset(key);
    setCustomExtensions(CONTEXT_PRESETS[key].textExtensions.join(', '));
    setCustomIgnore('');
  };

  /**
   * Интеллектуальная обработка выбора директории.
   */
  const handleDirectorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const fileList = Array.from(e.target.files);
    const fileNames = fileList.map((f) => f.name);

    // 1. АВТООПРЕДЕЛЕНИЕ ПРЕСЕТА (Signature Detection)
    let detectedPresetKey: PresetKey = selectedPreset;
    if (fileNames.includes('project.godot')) {
      detectedPresetKey = 'godot';
    } else if (fileNames.includes('package.json')) {
      detectedPresetKey = 'nextjs';
    }

    // Синхронизируем стейт, если пресет изменился
    if (detectedPresetKey !== selectedPreset) {
      setSelectedPreset(detectedPresetKey);
      setCustomExtensions(CONTEXT_PRESETS[detectedPresetKey].textExtensions.join(', '));
    }

    // Используем локальную переменную для активного пресета,
    // так как стейт обновится только в следующем рендере.
    const activePreset = CONTEXT_PRESETS[detectedPresetKey];

    // 2. Извлечение .gitignore
    const gitIgnoreFile = fileList.find((f) => f.name === '.gitignore');
    let gitIgnoreContent: string | null = null;
    if (gitIgnoreFile) {
      try {
        gitIgnoreContent = await gitIgnoreFile.text();
      } catch (err) {
        console.warn('⚠️ Не удалось прочитать .gitignore', err);
      }
    }

    // 3. Настройка менеджера игнорирования
    const customPatterns = customIgnore
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const ig = createIgnoreManager({
      gitIgnoreContent,
      ignorePatterns: [...activePreset.hardIgnore, ...customPatterns],
    });

    // 4. Фильтрация и создание узлов структуры
    const extList = (
      detectedPresetKey === selectedPreset
        ? customExtensions
        : activePreset.textExtensions.join(', ')
    )
      .split(',')
      .map((s) => s.trim().toLowerCase());

    const nodes: FileNode[] = [];

    for (const f of fileList) {
      const path = f.webkitRelativePath || f.name;
      const parts = path.split('/');
      const normalizedPath = parts.length > 1 ? parts.slice(1).join('/') : path;

      if (ig.ignores(normalizedPath)) continue;

      const isLocalContext = normalizedPath.startsWith(LOCAL_CONTEXT_FOLDER + '/');
      nodes.push({
        path: normalizedPath,
        name: f.name,
        size: f.size,
        file: f,
        isText: isTextFile(f.name, extList) || isLocalContext,
      });
    }

    setFiles(nodes);
    setResult(null);
    setStats(null);

    if (nodes.length > 0) {
      void processFiles(nodes);
    }
  };

  const processFiles = useCallback(
    async (filesToProcess?: FileNode[]) => {
      const targetFiles = filesToProcess || files;
      if (targetFiles.length === 0) return;

      setProcessing(true);

      try {
        const sources = await Promise.all(
          targetFiles
            .filter((f) => f.isText)
            .map(async (f) => ({
              path: f.path,
              name: f.name,
              content: await f.file.text(),
            }))
        );

        const generation = await runContextPipeline(sources, { includeTree });

        setStats(generation.stats);
        setResult(generation.output);
        setLastGeneratedAt(new Date());
      } catch (err) {
        console.error('Context Generation Failed:', err);
      } finally {
        setProcessing(false);
      }
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

      <div className="flex flex-col gap-2">
        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">1. Источник</label>
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 p-6 text-center transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="text-sm font-medium">
            {files.length > 0 ? `Файлов: ${files.length}` : 'Выбрать папку проекта'}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            // @ts-expect-error webkitdirectory is required
            webkitdirectory=""
            directory=""
            multiple
            onChange={handleDirectorySelect}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
          2. Конфигурация
        </label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CONTEXT_PRESETS) as PresetKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handlePresetChange(key)}
              className={cn(
                'rounded border px-3 py-1.5 text-xs font-medium transition-colors',
                selectedPreset === key
                  ? 'border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
              )}
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
        onClick={() => void processFiles()}
        disabled={files.length === 0 || processing}
        className={cn(
          'w-full rounded-lg py-3 font-bold text-white shadow-sm transition-all',
          files.length === 0
            ? 'bg-zinc-300 dark:bg-zinc-700'
            : 'bg-blue-600 shadow-blue-500/20 hover:bg-blue-700'
        )}
      >
        {processing ? 'Сборка...' : 'Сгенерировать'}
      </button>

      {stats && (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="mb-1 text-[10px] font-bold text-blue-600 uppercase dark:text-blue-300">
              Токены (Est.)
            </div>
            <div className="font-mono text-2xl font-bold text-blue-700 dark:text-blue-200">
              ~{stats.totalTokens.toLocaleString()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800">
              <div className="text-[10px] font-bold text-zinc-500 uppercase">Файлы кода</div>
              <div className="font-mono text-sm">{stats.fileCount}</div>
            </div>
            <div className="rounded border border-green-100 bg-green-50 p-2 dark:border-green-800 dark:bg-green-900/20">
              <div className="text-[10px] font-bold text-green-600 uppercase">Сжатие</div>
              <div className="font-mono text-sm text-green-700">
                -{stats.savingsPercentage.toFixed(0)}%
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-bold text-zinc-500 uppercase">Топ тяжелых файлов</div>
            {stats.topHeavyFiles.map((f, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded bg-zinc-50 px-2 py-1 font-mono text-[10px] dark:bg-zinc-800/50"
              >
                <span className="max-w-[140px] truncate">{f.path.split('/').pop()}</span>
                <span className="text-zinc-400">{f.size}</span>
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
                    className={cn(
                      'rounded px-3 py-1.5 text-xs font-bold transition-all',
                      copied ? 'bg-green-100 text-green-700' : 'bg-zinc-100 hover:bg-zinc-200'
                    )}
                  >
                    {copied ? 'Готово!' : 'Копировать'}
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
              <div className="flex-1 overflow-y-auto bg-white p-4 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                {result}
              </div>
            </Card>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-zinc-400">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                <span className="text-2xl">{processing ? '⚙️' : '🤖'}</span>
              </div>
              <p className="text-sm">
                {processing ? 'Сборка контекста...' : 'Выберите папку проекта'}
              </p>
            </div>
          )}
        </div>
      </Workbench.Stage>
    </Workbench.Root>
  );
}
