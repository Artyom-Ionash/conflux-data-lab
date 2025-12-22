'use client';

import React, { useCallback, useState } from 'react';

import { useCopyToClipboard } from '@/lib/core/hooks/use-copy-to-clipboard';
import { type ContextStats } from '@/lib/modules/context-generator/core';
import { runContextPipeline } from '@/lib/modules/context-generator/engine';
import { CONTEXT_PRESETS, type PresetKey } from '@/lib/modules/context-generator/rules';
import { useBundleManager } from '@/lib/modules/context-generator/use-bundle-manager';
import { Field, TextInput } from '@/view/tools/text/Input';
import { FileDropzone } from '@/view/ui/FileDropzone';
import { InfoBadge } from '@/view/ui/InfoBadge';
import { Stack } from '@/view/ui/Layout';
import { ProcessingOverlay } from '@/view/ui/ProcessingOverlay';
import { Switch } from '@/view/ui/Switch';
import { ToggleGroup, ToggleGroupItem } from '@/view/ui/ToggleGroup';
import { Workbench } from '@/view/ui/Workbench';

import { ResultViewer } from './text/ResultViewer';

export function ProjectToContext() {
  const { filteredPaths, handleFiles, bundle } = useBundleManager();
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

  // [LEMON] Обработка выбора директории
  const onFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;
    setProcessing(true);

    try {
      const {
        presetKey,
        visiblePaths,
        bundle: newBundle,
      } = await handleFiles(files, customExtensions, customIgnore);

      setSelectedPreset(presetKey);
      setCustomExtensions(CONTEXT_PRESETS[presetKey].textExtensions.join(', '));

      // Auto-process after load
      void processFiles(newBundle, visiblePaths, presetKey);
    } catch (err) {
      console.error('File selection failed:', err);
      setProcessing(false);
    }
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
    <Stack gap={6}>
      <Workbench.Header title="Project to Context" />

      <Field label="1. Источник">
        <FileDropzone
          onFilesSelected={onFilesSelected}
          directory
          accept="*"
          label={
            filteredPaths.length > 0 ? `Файлов: ${filteredPaths.length}` : 'Выбрать папку проекта'
          }
        />
      </Field>

      <Stack gap={4}>
        <Field label="2. Конфигурация">
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
        </Field>

        <Stack gap={3}>
          <TextInput
            value={customExtensions}
            onChange={(e) => setCustomExtensions(e.target.value)}
            placeholder="Расширения через запятую"
          />
          <TextInput
            value={customIgnore}
            onChange={(e) => setCustomIgnore(e.target.value)}
            placeholder="*.log, temp/ (игнорирование)"
          />
          <Switch
            label="Генерировать дерево"
            checked={includeTree}
            onCheckedChange={setIncludeTree}
          />
        </Stack>
      </Stack>

      <button
        onClick={() => void processFiles()}
        disabled={filteredPaths.length === 0 || processing}
        className="w-full rounded-lg bg-blue-600 py-3 font-bold text-white transition-opacity hover:opacity-90 disabled:bg-zinc-300 dark:disabled:bg-zinc-800"
      >
        {processing ? 'Сборка...' : 'Сгенерировать'}
      </button>

      {stats && (
        <Stack
          gap={4}
          className="animate-in fade-in slide-in-from-bottom-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"
        >
          <InfoBadge label="Токены (Est.)" className="justify-between py-2 text-lg">
            ~{stats.totalTokens.toLocaleString()}
          </InfoBadge>
        </Stack>
      )}
    </Stack>
  );

  return (
    <Workbench.Root>
      <Workbench.Sidebar>{sidebar}</Workbench.Sidebar>
      <Workbench.Stage>
        <Workbench.Content className="flex flex-col overflow-hidden bg-zinc-50 dark:bg-black/20">
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
        </Workbench.Content>
      </Workbench.Stage>
    </Workbench.Root>
  );
}
