'use client';

import React, { useCallback, useRef, useState } from 'react';

import { useCopyToClipboard } from '@/lib/core/hooks/use-copy-to-clipboard';
import { type ContextStats } from '@/lib/modules/context-generator/core';
import { runContextPipeline } from '@/lib/modules/context-generator/engine';
import { CONTEXT_PRESETS, type PresetKey } from '@/lib/modules/context-generator/rules';
import { useBundleManager } from '@/lib/modules/context-generator/use-bundle-manager';
import { InfoBadge } from '@/view/ui/InfoBadge';
import { ProcessingOverlay } from '@/view/ui/ProcessingOverlay';
import { Switch } from '@/view/ui/Switch';
import { ToggleGroup, ToggleGroupItem } from '@/view/ui/ToggleGroup';
import { Workbench } from '@/view/ui/Workbench';

import { ResultViewer } from './text/ResultViewer';

export function ProjectToContext() {
  const { bundle, filteredPaths, handleFiles } = useBundleManager();
  const { isCopied, copy } = useCopyToClipboard();

  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('nextjs');
  const [customExtensions, setCustomExtensions] = useState<string>(
    CONTEXT_PRESETS.nextjs.textExtensions.join(', ')
  );
  const [customIgnore, setCustomIgnore] = useState<string>('');
  const [includeTree, setIncludeTree] = useState(true);

  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [stats, setStats] = useState<ContextStats | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDirectorySelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setProcessing(true);

    const {
      presetKey,
      visiblePaths,
      bundle: newBundle,
    } = await handleFiles(Array.from(e.target.files), customExtensions, customIgnore);

    setSelectedPreset(presetKey);
    setCustomExtensions(CONTEXT_PRESETS[presetKey].textExtensions.join(', '));

    // Auto-process after load
    void processFiles(newBundle, visiblePaths, presetKey);
  };

  const processFiles = useCallback(
    async (activeBundle = bundle, paths = filteredPaths, presetKey = selectedPreset) => {
      if (!activeBundle || paths.length === 0) return;

      setResult(null);
      setProcessing(true);

      try {
        const textFiles = activeBundle
          .getItems()
          .filter((item) => paths.includes(item.path) && item.isText);

        const sources = await Promise.all(
          textFiles.map(async (f) => ({
            path: f.path,
            name: f.name,
            content: await f.file.text(),
          }))
        );

        const generation = await runContextPipeline(sources, {
          includeTree,
          preset: CONTEXT_PRESETS[presetKey],
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
      <Workbench.Header title="Project to Context" />

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
            onChange={onDirectorySelect}
            {...({
              webkitdirectory: '',
              directory: '',
            } as React.InputHTMLAttributes<HTMLInputElement> & {
              webkitdirectory?: string;
              directory?: string;
            })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
          2. Конфигурация
        </label>

        <ToggleGroup
          type="single"
          value={selectedPreset}
          onValueChange={(val) => {
            if (val) {
              const key = val as PresetKey;
              setSelectedPreset(key);
              setCustomExtensions(CONTEXT_PRESETS[key].textExtensions.join(', '));
            }
          }}
          gridCols={2}
        >
          {(Object.keys(CONTEXT_PRESETS) as PresetKey[]).map((key) => (
            <ToggleGroupItem key={key} value={key}>
              {CONTEXT_PRESETS[key].name}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

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
        className="w-full rounded-lg bg-blue-600 py-3 font-bold text-white transition-opacity hover:opacity-90 disabled:bg-zinc-300 dark:disabled:bg-zinc-800"
      >
        {processing ? 'Сборка...' : 'Сгенерировать'}
      </button>

      {stats && (
        <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <InfoBadge label="Токены (Est.)" className="w-full justify-between py-2 text-lg">
            ~{stats.totalTokens.toLocaleString()}
          </InfoBadge>
        </div>
      )}
    </div>
  );

  return (
    <Workbench.Root>
      <Workbench.Sidebar>{sidebar}</Workbench.Sidebar>
      <Workbench.Stage>
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-zinc-50 p-4 dark:bg-black/20">
          <ResultViewer
            title={
              result && !processing
                ? `Результат контекста ${lastGeneratedAt?.toLocaleTimeString()}`
                : 'Ожидание сборки'
            }
            value={!processing ? result : null}
            isCopied={isCopied}
            onCopy={copy}
            onDownload={downloadResult}
            downloadLabel="Скачать .txt"
            placeholder={processing ? 'Сборка контекста...' : 'Выберите папку проекта'}
          />
          <ProcessingOverlay isVisible={processing} message="Сборка контекста проекта..." />
        </div>
      </Workbench.Stage>
    </Workbench.Root>
  );
}
