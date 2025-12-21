'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { type ContextStats } from '@/lib/modules/context-generator/core';
import { runContextPipeline } from '@/lib/modules/context-generator/engine';
import { CONTEXT_PRESETS, type PresetKey } from '@/lib/modules/context-generator/rules';
import { FileBundle } from '@/lib/modules/file-system/bundle';
import { createIgnoreManager } from '@/lib/modules/file-system/scanner';
import { Card } from '@/view/ui/Card';
import { cn } from '@/view/ui/infrastructure/standards';
import { ProcessingOverlay } from '@/view/ui/ProcessingOverlay'; // Добавлено
import { Switch } from '@/view/ui/Switch';
import { Workbench } from '@/view/ui/Workbench';

export function ProjectToContext() {
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('nextjs');

  const [customExtensions, setCustomExtensions] = useState<string>(
    CONTEXT_PRESETS.nextjs.textExtensions.join(', ')
  );
  const [customIgnore, setCustomIgnore] = useState<string>('');
  const [includeTree, setIncludeTree] = useState(true);

  const [bundle, setBundle] = useState<FileBundle | null>(null);
  const [filteredPaths, setFilteredPaths] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [stats, setStats] = useState<ContextStats | null>(null);
  const [copied, setCopied] = useState(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => bundle?.dispose(), [bundle]);

  const handlePresetChange = (key: PresetKey) => {
    const preset = CONTEXT_PRESETS[key];
    setSelectedPreset(key);
    setCustomExtensions(preset.textExtensions.join(', '));
    setCustomIgnore('');
    // Сбрасываем результат, так как он не соответствует новому пресету
    setResult(null);
    setStats(null);
  };

  const handleDirectorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    // Мгновенная визуальная индикация сброса
    setResult(null);
    setStats(null);
    setProcessing(true);

    bundle?.dispose();
    const fileList = Array.from(e.target.files);

    const newBundle = new FileBundle(fileList, {
      customExtensions: customExtensions.split(',').map((s) => s.trim()),
    });

    const activePresetKey = newBundle.detectedPreset;
    setSelectedPreset(activePresetKey);

    const activePreset = CONTEXT_PRESETS[activePresetKey];
    setCustomExtensions(activePreset.textExtensions.join(', '));

    const gitIgnoreFile = fileList.find((f) => f.name === '.gitignore');
    const gitIgnoreContent = gitIgnoreFile ? await gitIgnoreFile.text() : null;

    const ig = createIgnoreManager({
      gitIgnoreContent,
      ignorePatterns: [
        ...activePreset.hardIgnore,
        ...customIgnore
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ],
    });

    const items = newBundle.getItems();
    const visiblePaths = items.filter((item) => !ig.ignores(item.path)).map((item) => item.path);

    setBundle(newBundle);
    setFilteredPaths(visiblePaths);

    if (visiblePaths.length > 0) {
      void processFiles(newBundle, visiblePaths, activePresetKey);
    } else {
      setProcessing(false);
    }
  };

  const processFiles = useCallback(
    async (activeBundle?: FileBundle, paths?: string[], presetKey?: PresetKey) => {
      const targetBundle = activeBundle || bundle;
      const targetPaths = paths || filteredPaths;
      const targetPreset = presetKey || selectedPreset;

      if (!targetBundle || targetPaths.length === 0) return;

      // Очистка старого состояния перед началом новой генерации
      setResult(null);
      setStats(null);
      setProcessing(true);

      try {
        const textFiles = targetBundle
          .getItems()
          .filter((item) => targetPaths.includes(item.path) && item.isText);

        const sources = await Promise.all(
          textFiles.map(async (f) => ({
            path: f.path,
            name: f.name,
            content: await f.file.text(),
          }))
        );

        const generation = await runContextPipeline(sources, {
          includeTree,
          preset: CONTEXT_PRESETS[targetPreset],
        });

        setStats(generation.stats);
        setResult(generation.output);
        setLastGeneratedAt(new Date());
      } catch (err) {
        console.error('Context Generation Failed:', err);
      } finally {
        setProcessing(false);
      }
    },
    [bundle, filteredPaths, includeTree, selectedPreset]
  );

  const copyToClipboard = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('Ошибка при копировании.');
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
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
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
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 p-6 text-center hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="text-sm font-medium">
            {filteredPaths.length > 0 ? `Файлов: ${filteredPaths.length}` : 'Выбрать папку проекта'}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            onChange={handleDirectorySelect}
            {...({
              webkitdirectory: '',
              directory: '',
            } as React.InputHTMLAttributes<HTMLInputElement>)}
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
                'rounded border px-3 py-1.5 text-xs font-medium',
                selectedPreset === key
                  ? 'border-blue-300 bg-blue-100 text-blue-800'
                  : 'border-zinc-200 bg-white text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800'
              )}
            >
              {CONTEXT_PRESETS[key].name}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={customExtensions}
            onChange={(e) => setCustomExtensions(e.target.value)}
            className="w-full rounded border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            type="text"
            value={customIgnore}
            onChange={(e) => setCustomIgnore(e.target.value)}
            placeholder="*.log, temp/"
            className="w-full rounded border border-zinc-200 bg-white px-3 py-2 font-mono text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
          <Switch
            label="Генерировать дерево"
            checked={includeTree}
            onCheckedChange={setIncludeTree}
          />
        </div>
      </div>

      <button
        onClick={() => void processFiles()}
        disabled={filteredPaths.length === 0 || processing}
        className={cn(
          'w-full rounded-lg py-3 font-bold text-white',
          filteredPaths.length === 0 ? 'bg-zinc-300' : 'bg-blue-600 hover:bg-blue-700'
        )}
      >
        {processing ? 'Сборка...' : 'Сгенерировать'}
      </button>

      {stats && (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20">
            <div className="text-[10px] font-bold text-blue-600 uppercase">Токены (Est.)</div>
            <div className="font-mono text-2xl font-bold text-blue-700 dark:text-blue-200">
              ~{stats.totalTokens.toLocaleString()}
            </div>
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
          {/* Условие изменено: показываем результат только если не идет обработка */}
          {result && !processing ? (
            <Card
              className="flex h-full flex-1 flex-col"
              title={<span>Результат контекста {lastGeneratedAt?.toLocaleTimeString()}</span>}
              contentClassName="p-0 flex-1 overflow-hidden flex flex-col"
              headerActions={
                <div className="flex gap-2">
                  <button
                    onClick={copyToClipboard}
                    className={cn(
                      'rounded px-3 py-1.5 text-xs font-bold',
                      copied ? 'bg-green-100 text-green-700' : 'bg-zinc-100'
                    )}
                  >
                    {copied ? 'Готово!' : 'Копировать'}
                  </button>
                  <button
                    onClick={downloadResult}
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Скачать .txt
                  </button>
                </div>
              }
            >
              <div className="flex-1 overflow-y-auto bg-white p-4 font-mono text-[11px] whitespace-pre-wrap dark:bg-zinc-950">
                {result}
              </div>
            </Card>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-zinc-400">
              <span className="mb-4 text-2xl">{processing ? '⚙️' : '🤖'}</span>
              <p className="text-sm">
                {processing ? 'Сборка контекста...' : 'Выберите папку проекта'}
              </p>
            </div>
          )}

          {/* Дополнительный слой индикации для "тяжелых" процессов */}
          <ProcessingOverlay isVisible={processing} message="Сборка контекста проекта..." />
        </div>
      </Workbench.Stage>
    </Workbench.Root>
  );
}
