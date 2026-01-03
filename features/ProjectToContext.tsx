'use client';

import React, { useCallback, useState } from 'react';
import { chunk } from 'remeda';

import { downloadText } from '@/core/browser/canvas';
import { isOneOf } from '@/core/primitives/guards';
import { useCopyToClipboard } from '@/core/react/hooks/use-copy';
import { useTask } from '@/core/react/hooks/use-task';
import { useWorkerPool } from '@/core/react/hooks/use-worker-pool';
import { type ContextGenerationResult, generateContextOutput } from '@/lib/context-generator/core';
import type {
  ProcessingPayload,
  ProcessingResponse,
} from '@/lib/context-generator/processing.worker';
import {
  createIgnoreManager,
  type FileSystemDirectoryHandle,
  scanDirectoryHandle,
} from '@/lib/context-generator/scanner';
import { useBundleManager } from '@/lib/context-generator/use-bundle-manager';
import { isTextFile } from '@/lib/file-system/analyzers';
import { type FileBundle } from '@/lib/file-system/bundle';
import { formatBytes, generateAsciiTree } from '@/lib/file-system/topology';
import { Field } from '@/ui/atoms/input/Field';
import { TextInput } from '@/ui/atoms/input/Input';
import { Switch } from '@/ui/atoms/input/Switch';
import { ToggleGroup, ToggleGroupItem } from '@/ui/atoms/input/ToggleGroup';
import { Stack } from '@/ui/atoms/layout/Layout';
import { Icon } from '@/ui/atoms/primitive/Icon';
import { Indicator } from '@/ui/atoms/primitive/Indicator';
import { ResultViewer } from '@/ui/molecules/display/ResultViewer';
import { ProcessingOverlay } from '@/ui/molecules/feedback/ProcessingOverlay';
import { Button } from '@/ui/molecules/input/Button';
import { Workbench } from '@/ui/molecules/layout/Workbench';

import { CONTEXT_PRESETS, HEAVY_DIRS, type PresetKey } from '../lib/context-generator/rules';
import { FileDropzonePlaceholder } from './_io/FileDropzone';
import { SidebarIO } from './_io/SidebarIO';

const PRESET_KEYS = Object.keys(CONTEXT_PRESETS).filter((k): k is PresetKey =>
  Object.prototype.hasOwnProperty.call(CONTEXT_PRESETS, k)
);

// Размер пачки файлов на один воркер
const BATCH_SIZE = 50;

export function ProjectToContext() {
  const { filteredPaths, handleFiles, bundle } = useBundleManager();
  const { isCopied, copy } = useCopyToClipboard();

  // UI State
  const [selectedPreset, setSelectedPreset] = useState<PresetKey>('nextjs');
  const [customExtensions, setCustomExtensions] = useState<string>(
    CONTEXT_PRESETS.nextjs.textExtensions.join(', ')
  );
  const [customIgnore, setCustomIgnore] = useState<string>('');
  const [includeTree, setIncludeTree] = useState(true);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<Date | null>(null);
  const [activeDirectoryHandle, setActiveDirectoryHandle] =
    useState<FileSystemDirectoryHandle | null>(null);

  // Worker Pool
  const createWorker = useCallback(
    () => new Worker(new URL('@/lib/context-generator/processing.worker.ts', import.meta.url)),
    []
  );
  const { runTask: runWorkerTask } = useWorkerPool<ProcessingPayload, ProcessingResponse>({
    workerFactory: createWorker,
    // Pool size определяется автоматически (hardwareConcurrency - 1)
  });

  // --- MAIN PROCESSING TASK ---
  // Теперь принимает сырые параметры фильтрации, чтобы не зависеть от stale state
  const processingTask = useTask<
    ContextGenerationResult,
    [FileBundle, PresetKey, string, string] // Bundle, Preset, ExtensionsStr, IgnoreStr
  >(async ({ signal, setProgress }, activeBundle, presetKey, extensionsStr, ignoreStr) => {
    if (signal.aborted) throw new Error('Aborted');

    const preset = CONTEXT_PRESETS[presetKey];

    // 1. Парсинг правил "на лету" (Runtime Configuration)
    const allowedExtensions = extensionsStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const ignoreManager = createIgnoreManager({
      ignorePatterns: [
        ...preset.hardIgnore,
        ...ignoreStr
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ],
    });

    // 2. Фильтрация бандла (Dynamic Filtering)
    // Мы не верим бандлу на слово про isText, перепроверяем по текущим настройкам
    const allItems = activeBundle.getItems();

    const targetItems = allItems.filter((item) => {
      // A. Игнор-лист
      if (ignoreManager.ignores(item.path)) return false;

      // B. Tree Only (файлы, которые нужны в дереве, но не в контексте)
      // Если файл в treeOnly, мы его пропускаем здесь (он добавится в дерево отдельно)
      const isTreeOnly = preset.treeOnly?.some((rule) => item.path.startsWith(rule));
      if (isTreeOnly) return false;

      // C. Текстовый ли файл? (Проверка по ТЕКУЩИМ расширениям)
      return isTextFile(item.name, allowedExtensions);
    });

    // 3. Подготовка чанков
    const fileBatches = chunk(targetItems, BATCH_SIZE);
    const totalBatches = fileBatches.length;
    let completedBatches = 0;

    const chunkPromises = fileBatches.map(async (batch) => {
      const files = batch.map((node) => node.file);
      const response = await runWorkerTask({ files });
      if (response.error) throw new Error(response.error);
      completedBatches++;
      setProgress(Math.round((completedBatches / totalBatches) * 90));
      return response.results;
    });

    const resultsNested = await Promise.all(chunkPromises);

    if (signal.aborted) throw new Error('Aborted');

    // Сборка результатов (Reduce Phase)
    // Flatten массива массивов + Mapping типов
    const processedFiles = resultsNested.flat().map((file) => ({
      ...file,
      size: file.cleanedSize,
    }));

    // 4. Генерация дерева (включает файлы, которые были отфильтрованы по isText, но не по ignore)
    let treeString = '';
    if (includeTree) {
      const treeNodes = allItems
        .filter((item) => !ignoreManager.ignores(item.path))
        .map((item) => ({
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
  });

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
  const onFilesSelected = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      try {
        // 1. Создаем бандл (это быстро, просто индексация)
        // Передаем пустые расширения, чтобы бандл сам определил пресет
        const { presetKey, bundle: newBundle } = await handleFiles(files, '', customIgnore);

        // 2. Вычисляем дефолтные настройки для этого пресета
        const detectedExtensions = CONTEXT_PRESETS[presetKey].textExtensions.join(', ');

        // 3. Обновляем UI
        setSelectedPreset(presetKey);
        setCustomExtensions(detectedExtensions);

        // 4. ЗАПУСКАЕМ ТАСК С ЯВНЫМИ ПАРАМЕТРАМИ
        // Не ждем обновления стейта (customExtensions), передаем detectedExtensions напрямую
        void processingTask.run(newBundle, presetKey, detectedExtensions, customIgnore);
      } catch (err) {
        console.error('File selection failed:', err);
      }
    },
    [handleFiles, customIgnore, processingTask]
  );

  const handleManualRun = () => {
    if (bundle) {
      // Здесь используем текущие значения из UI-стейта (пользователь мог их отредактировать)
      void processingTask.run(bundle, selectedPreset, customExtensions, customIgnore);
    }
  };

  const handleReload = useCallback(async () => {
    if (!activeDirectoryHandle) return;
    try {
      const files = await scanDirectoryHandle(activeDirectoryHandle, shouldSkipScan);
      void onFilesSelected(files);
    } catch (err) {
      console.error('Failed to rescan:', err);
      setActiveDirectoryHandle(null);
    }
  }, [activeDirectoryHandle, shouldSkipScan, onFilesSelected]);

  const downloadResult = () => {
    if (!processingTask.result?.output) return;
    downloadText(processingTask.result.output, 'project_context.txt');
  };

  const sidebar = (
    <Stack gap={6}>
      <Workbench.Header title="Project to Context" />

      <SidebarIO
        onFilesSelected={onFilesSelected}
        onDirectoryHandleReceived={setActiveDirectoryHandle}
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

      {activeDirectoryHandle && (
        <Button
          onClick={handleReload}
          disabled={processingTask.isRunning}
          variant="outline"
          className="w-full border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-900/20 dark:text-blue-300"
        >
          {processingTask.isRunning ? <Icon.Spinner className="animate-spin" /> : <Icon.Refresh />}
          {processingTask.isRunning ? 'Сканирование...' : 'Синхронизировать с диском'}
        </Button>
      )}

      <Stack gap={4}>
        <Field label="2. Конфигурация">
          <ToggleGroup
            type="single"
            value={selectedPreset}
            onValueChange={(val) => {
              if (val && isOneOf(val, PRESET_KEYS)) {
                setSelectedPreset(val);
                setCustomExtensions(CONTEXT_PRESETS[val].textExtensions.join(', '));
              }
            }}
            gridCols={2}
          >
            {PRESET_KEYS.map((key) => (
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
            {processingTask.isRunning ? 'Сборка...' : 'Применить фильтры'}
          </Button>
        )}
      </Stack>

      {processingTask.result?.stats && (
        <Stack
          gap={4}
          className="animate-in fade-in slide-in-from-bottom-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"
        >
          <Indicator label="Размер" className="justify-between py-2 text-lg">
            {formatBytes(processingTask.result.stats.cleanedSizeBytes)}
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
            onDirectoryHandleReceived={setActiveDirectoryHandle}
            directory={true}
            shouldSkip={shouldSkipScan}
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
