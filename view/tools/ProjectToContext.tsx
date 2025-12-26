'use client';

import React, { useCallback, useState } from 'react';
import { chunk } from 'remeda';

import { downloadText } from '@/core/browser/canvas';
import { useCopyToClipboard } from '@/core/react/hooks/use-copy';
import { useTask } from '@/core/react/hooks/use-task';
import { useWorkerPool } from '@/core/react/hooks/use-worker-pool';
import { type ContextGenerationResult, generateContextOutput } from '@/lib/context-generator/core';
import type {
  ProcessingPayload,
  ProcessingResponse,
} from '@/lib/context-generator/processing.worker';
import { useBundleManager } from '@/lib/context-generator/use-bundle-manager';
import { type FileBundle } from '@/lib/file-system/bundle';
import { generateAsciiTree } from '@/lib/file-system/topology';
import { ProcessingOverlay } from '@/view/ui/feedback/ProcessingOverlay';
import { Button } from '@/view/ui/input/Button';
import { Field } from '@/view/ui/input/Field';
import { TextInput } from '@/view/ui/input/Input';
import { Switch } from '@/view/ui/input/Switch';
import { ToggleGroup, ToggleGroupItem } from '@/view/ui/input/ToggleGroup';
import { Stack } from '@/view/ui/layout/Layout';
import { Workbench } from '@/view/ui/layout/Workbench';
import { Icon } from '@/view/ui/primitive/Icon';
import { Indicator } from '@/view/ui/primitive/Indicator';

import { CONTEXT_PRESETS, HEAVY_DIRS, type PresetKey } from '../../lib/context-generator/rules';
import { FileDropzonePlaceholder } from './_io/FileDropzone';
import { ResultViewer } from './_io/ResultViewer';
import { SidebarIO } from './_io/SidebarIO';

// Размер пачки файлов на один воркер
const BATCH_SIZE = 50;

export function ProjectToContext() {
  const { filteredPaths, handleFiles, bundle } = useBundleManager();
  const { isCopied, copy } = useCopyToClipboard();

  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('nextjs');
  const [customExtensions, setCustomExtensions] = useState<string>(
    CONTEXT_PRESETS.nextjs.textExtensions.join(', ')
  );
  const [customIgnore, setCustomIgnore] = useState<string>('');
  const [includeTree, setIncludeTree] = useState(true);

  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);

  // --- WORKER POOL ---
  const createWorker = useCallback(
    () => new Worker(new URL('@/lib/context-generator/processing.worker.ts', import.meta.url)),
    []
  );

  const { runTask: runWorkerTask } = useWorkerPool<ProcessingPayload, ProcessingResponse>({
    workerFactory: createWorker,
    // Pool size определяется автоматически (hardwareConcurrency - 1)
  });

  // --- MAIN TASK ---
  // Signature: first arg is scope { signal, setProgress }
  const processingTask = useTask<ContextGenerationResult, [FileBundle, string[], PresetKey]>(
    async ({ signal, setProgress }, activeBundle, paths) => {
      if (signal.aborted) throw new Error('Aborted');

      // 1. Фильтрация списка файлов (Main Thread - быстро)
      const textNodes = activeBundle
        .getItems()
        .filter((item) => paths.includes(item.path) && item.isText);

      // 2. Подготовка чанков (Map Phase)
      const fileBatches = chunk(textNodes, BATCH_SIZE);
      const totalBatches = fileBatches.length;
      let completedBatches = 0;

      // 3. Параллельная обработка (Worker Pool)
      const chunkPromises = fileBatches.map(async (batch) => {
        // Извлекаем сырые File объекты для передачи в воркер
        const files = batch.map((node) => node.file);

        // Отправляем в пул
        const response = await runWorkerTask({ files });

        if (response.error) throw new Error(response.error);

        completedBatches++;
        setProgress(Math.round((completedBatches / totalBatches) * 90)); // До 90% прогресса

        return response.results;
      });

      // Ждем завершения всех воркеров
      const resultsNested = await Promise.all(chunkPromises);

      if (signal.aborted) throw new Error('Aborted');

      // 4. Сборка результатов (Reduce Phase)
      // Flatten массива массивов + Mapping типов
      const processedFiles = resultsNested.flat().map((file) => ({
        ...file,
        size: file.cleanedSize, // FIX: Маппинг cleanedSize -> size
      }));

      // 5. Финальная сборка строки (Main Thread)
      let treeString = '';
      if (includeTree) {
        // Собираем ноды для дерева
        const treeNodes = activeBundle.getItems().map((item) => ({
          path: item.path,
          name: item.name,
          size: item.size,
          isText: item.isText,
        }));

        treeString = generateAsciiTree(treeNodes);
      }

      const generation = generateContextOutput(processedFiles, treeString);

      setLastGeneratedAt(new Date());
      setProgress(100);
      return generation;
    }
  );

  const shouldSkipScan = useCallback((path: string) => {
    const parts = path.split('/');
    return parts.some((p) => HEAVY_DIRS.includes(p));
  }, []);

  /**
   * Обработка выбора файлов.
   * АВТОМАТИЗАЦИЯ: Сразу после индексации запускается генерация.
   *
   * ⚠️ ПРЕДУПРЕЖДЕНИЕ:
   * Эта функция отвечает только за формирование СПИСКА файлов (FileBundle).
   * В ней НЕЛЬЗЯ вызывать чтение контента (file.text()), иначе интерфейс
   * зависнет на проектах с 5000+ файлами.
   */
  const onFilesSelected = async (files: File[]) => {
    if (files.length === 0) return;

    try {
      // 1. Индексация (Bundle Manager)
      const {
        presetKey,
        visiblePaths,
        bundle: newBundle,
      } = await handleFiles(files, customExtensions, customIgnore);

      setSelectedPreset(presetKey);
      setCustomExtensions(CONTEXT_PRESETS[presetKey].textExtensions.join(', '));

      // 2. Автоматический запуск генерации через таск
      void processingTask.run(newBundle, visiblePaths, presetKey);
    } catch (err) {
      console.error('File selection failed:', err);
    }
  };

  const handleManualRun = () => {
    if (bundle) {
      void processingTask.run(bundle, filteredPaths, selectedPreset);
    }
  };

  const downloadResult = () => {
    if (!processingTask.result?.output) return;
    downloadText(processingTask.result.output, 'project_context.txt');
  };

  const sidebar = (
    <Stack gap={6}>
      <Workbench.Header title="Project to Context" />

      <SidebarIO
        onFilesSelected={onFilesSelected}
        onScanStarted={() => {}}
        shouldSkip={shouldSkipScan}
        directory
        accept="*"
        dropLabel={filteredPaths.length > 0 ? `Файлов: ${filteredPaths.length}` : 'Выбрать папку'}
        hasFiles={filteredPaths.length > 0 && !!processingTask.result}
        onDownload={downloadResult}
        downloadLabel="Скачать .txt"
        downloadDisabled={processingTask.isRunning}
      />

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
          <Field label="Расширения">
            <TextInput
              value={customExtensions}
              onChange={(e) => setCustomExtensions(e.target.value)}
              placeholder="Расширения через запятую"
            />
          </Field>
          <Field label="Игнорировать">
            <TextInput
              value={customIgnore}
              onChange={(e) => setCustomIgnore(e.target.value)}
              placeholder="*.log, temp/"
            />
          </Field>
          <Switch
            label="Генерировать дерево"
            checked={includeTree}
            onCheckedChange={setIncludeTree}
          />
        </Stack>

        {filteredPaths.length > 0 && (
          <Button
            onClick={handleManualRun}
            disabled={processingTask.isRunning}
            variant="default"
            className="w-full bg-blue-600 font-bold tracking-wide text-white uppercase hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            {processingTask.isRunning ? 'Обновление...' : 'Обновить контекст'}
          </Button>
        )}
      </Stack>

      {processingTask.result?.stats && (
        <Stack
          gap={4}
          className="animate-in fade-in slide-in-from-bottom-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"
        >
          <Indicator label="Токены (Est.)" className="justify-between py-2 text-lg">
            ~{processingTask.result.stats.totalTokens.toLocaleString()}
          </Indicator>
        </Stack>
      )}
    </Stack>
  );

  const FolderIcon = <Icon.Folder className="h-10 w-10 text-zinc-400 dark:text-zinc-500" />;

  return (
    <Workbench.Root>
      <Workbench.Sidebar>{sidebar}</Workbench.Sidebar>
      <Workbench.Stage>
        {/*
            UNIFIED EMPTY STATE LOGIC:
            Показываем результат только если он есть или процесс идёт.
            Иначе показываем приглашение выбрать папку.
        */}
        {processingTask.result || processingTask.isRunning ? (
          <Workbench.Content className="flex flex-col overflow-hidden bg-zinc-50 dark:bg-black/20">
            <ResultViewer
              title={
                !processingTask.isRunning
                  ? `Результат контекста ${lastGeneratedAt?.toLocaleTimeString()}`
                  : 'Сборка контекста...'
              }
              value={!processingTask.isRunning ? (processingTask.result?.output ?? null) : null}
              isCopied={isCopied}
              onCopy={copy}
              onDownload={downloadResult}
              downloadLabel="Скачать .txt"
              placeholder="Ожидание результатов..."
            />
          </Workbench.Content>
        ) : (
          <FileDropzonePlaceholder
            onUpload={onFilesSelected}
            directory={true}
            title="Выберите папку проекта"
            subTitle="Поддерживаются Next.js, Godot и другие структуры"
            icon={FolderIcon}
          />
        )}
        <ProcessingOverlay
          isVisible={processingTask.isRunning}
          message={`Обработка (${processingTask.progress}%)...`}
        />
      </Workbench.Stage>
    </Workbench.Root>
  );
}
