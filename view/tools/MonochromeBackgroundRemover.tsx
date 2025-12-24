'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { downloadDataUrl } from '@/core/browser/canvas';
import { hexToRgb, invertHex, rgbToHex } from '@/core/primitives/colors';
import { useDebounceEffect } from '@/core/react/hooks/use-debounce';
import { useWorker } from '@/core/react/hooks/use-worker';
import type {
  ProcessingMode,
  WorkerPayload,
  WorkerResponse,
} from '@/lib/graphics/processing/background-engine.worker';
import type { Point } from '@/lib/graphics/processing/imaging';
// ✅ ИМПОРТ ИЗ БИЗНЕС-СЛОЯ
import { useImageMetadata } from '@/lib/graphics/use-image-metadata';
import { CanvasMovable, useCanvasRef } from '@/view/ui/canvas/Canvas';
import { ActionGroup } from '@/view/ui/container/ActionGroup';
import { StatusBox } from '@/view/ui/container/StatusBox';
import { Button } from '@/view/ui/input/Button';
import { ColorInput } from '@/view/ui/input/ColorInput';
import { Slider } from '@/view/ui/input/Slider';
import { ToggleGroup, ToggleGroupItem } from '@/view/ui/input/ToggleGroup';
import { EngineRoom } from '@/view/ui/layout/EngineRoom';
import { Group, Stack } from '@/view/ui/layout/Layout';
import { Workbench } from '@/view/ui/layout/Workbench';
import { Separator } from '@/view/ui/primitive/Separator';
import { Typography } from '@/view/ui/primitive/Typography';

import { WorkbenchCanvas } from './_graphics/WorkbenchCanvas';
import { ControlSection } from './_io/ControlSection';
import { FileDropzonePlaceholder } from './_io/FileDropzone';
import { SidebarIO } from './_io/SidebarIO';

// --- CONSTANTS ---
const DEBOUNCE_DELAY = 50;
const MOUSE_BUTTON_LEFT = 0;
const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 ** 2);
const DOWNLOAD_FILENAME = 'removed_bg.png';
const OFFSET_R = 0;
const OFFSET_G = 1;
const OFFSET_B = 2;

const DEFAULT_SETTINGS = {
  targetColor: '#ffffff',
  contourColor: '#000000',
  tolerance: 20,
  smoothness: 10,
  edgeChoke: 0,
  edgeBlur: 0,
  edgePaint: 0,
};

export function MonochromeBackgroundRemover() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // ✅ ИСПОЛЬЗУЕМ ДОМЕННЫЙ ХУК
  const {
    url: originalUrl,
    width: imgW,
    height: imgH,
    bgColor,
    isLoading: isMetadataLoading,
  } = useImageMetadata(selectedFile);

  const [targetColor, setTargetColor] = useState(DEFAULT_SETTINGS.targetColor);
  const [contourColor, setContourColor] = useState(DEFAULT_SETTINGS.contourColor);

  const [tolerances, setTolerances] = useState<Record<ProcessingMode, number>>({
    remove: DEFAULT_SETTINGS.tolerance,
    keep: DEFAULT_SETTINGS.tolerance,
    'flood-clear': DEFAULT_SETTINGS.tolerance,
  });
  const [smoothness, setSmoothness] = useState(DEFAULT_SETTINGS.smoothness);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('remove');

  const [edgeChoke, setEdgeChoke] = useState(DEFAULT_SETTINGS.edgeChoke);
  const [edgeBlur, setEdgeBlur] = useState(DEFAULT_SETTINGS.edgeBlur);
  const [edgePaint, setEdgePaint] = useState(DEFAULT_SETTINGS.edgePaint);

  const [floodPoints, setFloodPoints] = useState<Point[]>([]);
  const [manualTrigger, setManualTrigger] = useState(0);

  const [isProcessing, setIsProcessing] = useState(false);

  const { ref: workspaceRef, getScale } = useCanvasRef();
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const createWorker = useCallback(
    () =>
      new Worker(new URL('@/lib/graphics/processing/background-engine.worker.ts', import.meta.url)),
    []
  );

  const handleWorkerMessage = useCallback((data: WorkerResponse) => {
    const { processedData, error } = data;
    if (error) {
      console.error(error);
      setIsProcessing(false);
      return;
    }
    if (previewCanvasRef.current && processedData) {
      const ctx = previewCanvasRef.current.getContext('2d');
      const imgData = new ImageData(
        new Uint8ClampedArray(
          processedData.buffer as ArrayBuffer,
          processedData.byteOffset,
          processedData.length
        ),
        previewCanvasRef.current.width,
        previewCanvasRef.current.height
      );
      ctx?.putImageData(imgData, 0, 0);
    }
    setIsProcessing(false);
  }, []);

  const { postMessage } = useWorker<WorkerPayload, WorkerResponse>({
    workerFactory: createWorker,
    onMessage: handleWorkerMessage,
  });

  // Автоматическая инициализация при получении новых метаданных
  useEffect(() => {
    if (!originalUrl || !imgW || !imgH) return;

    // Используем RAF для избежания синхронного каскада рендеров
    requestAnimationFrame(() => {
      if (bgColor) {
        setTargetColor(bgColor);
        setContourColor(invertHex(bgColor));
      }
    });

    if (sourceCanvasRef.current) {
      sourceCanvasRef.current.width = imgW;
      sourceCanvasRef.current.height = imgH;
      const ctx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
      const img = new window.Image();
      img.onload = () => {
        ctx?.drawImage(img, 0, 0);
        if (previewCanvasRef.current) {
          previewCanvasRef.current.width = imgW;
          previewCanvasRef.current.height = imgH;
          previewCanvasRef.current.getContext('2d')?.drawImage(img, 0, 0);
        }
        workspaceRef.current?.resetView(imgW, imgH);
      };
      img.src = originalUrl;
    }
  }, [originalUrl, imgW, imgH, bgColor, workspaceRef]);

  const processImage = useCallback(() => {
    if (!originalUrl || !sourceCanvasRef.current) return;
    const sourceCtx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!sourceCtx) return;
    const width = sourceCanvasRef.current.width;
    const height = sourceCanvasRef.current.height;
    const imageData = sourceCtx.getImageData(0, 0, width, height);
    const targetRGB = hexToRgb(targetColor);
    const contourRGB = hexToRgb(contourColor);
    if (!targetRGB || !contourRGB) return;
    setIsProcessing(true);
    const payload: WorkerPayload = {
      imageData: imageData.data,
      width,
      height,
      mode: processingMode,
      settings: {
        targetColor: targetRGB,
        contourColor: contourRGB,
        tolerance: tolerances[processingMode] ?? 0,
        smoothness,
        edgeChoke,
        edgeBlur,
        edgePaint,
        maxRgbDistance: MAX_RGB_DISTANCE,
        floodPoints: [...floodPoints],
      },
    };
    postMessage(payload, [imageData.data.buffer]);
  }, [
    originalUrl,
    targetColor,
    contourColor,
    tolerances,
    smoothness,
    processingMode,
    floodPoints,
    edgeChoke,
    edgeBlur,
    edgePaint,
    postMessage,
  ]);

  useDebounceEffect(
    () => {
      if (originalUrl) void processImage();
    },
    [originalUrl, processImage],
    DEBOUNCE_DELAY
  );

  useEffect(() => {
    if (manualTrigger > 0 && processingMode === 'flood-clear') {
      const timer = setTimeout(() => processImage(), 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [manualTrigger, processingMode, processImage]);

  const handleFilesSelected = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFloodPoints([]);
    setSelectedFile(file);
  };

  const handleDownload = () => {
    if (previewCanvasRef.current) {
      downloadDataUrl(previewCanvasRef.current.toDataURL('image/png'), DOWNLOAD_FILENAME);
    }
  };

  const getRelativeImageCoords = (clientX: number, clientY: number): Point | null => {
    if (!workspaceRef.current || !imgW) return null;
    const world = workspaceRef.current.screenToWorld(clientX, clientY);
    const x = Math.floor(world.x);
    const y = Math.floor(world.y);
    if (x >= 0 && x < imgW && y >= 0 && y < imgH) return { x, y };
    return null;
  };

  const handleImagePointerDown = (e: React.PointerEvent) => {
    if (e.button !== MOUSE_BUTTON_LEFT) return;
    if (processingMode === 'flood-clear') {
      const coords = getRelativeImageCoords(e.clientX, e.clientY);
      if (coords) setFloodPoints((prev) => [...prev, coords]);
    }
  };

  const handlePointMove = useCallback((index: number, newPos: { x: number; y: number }) => {
    setFloodPoints((prev) => {
      const next = [...prev];
      if (next[index]) next[index] = newPos;
      return next;
    });
  }, []);

  const handleEyedropper = (e: React.MouseEvent) => {
    if (!sourceCanvasRef.current) return;
    const coords = getRelativeImageCoords(e.clientX, e.clientY);
    if (!coords) return;
    const ctx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const p = ctx.getImageData(coords.x, coords.y, 1, 1).data;
      setTargetColor(rgbToHex(p[OFFSET_R] ?? 0, p[OFFSET_G] ?? 0, p[OFFSET_B] ?? 0));
    }
  };

  const removeLastPoint = () => setFloodPoints((prev) => prev.slice(0, -1));
  const clearAllPoints = () => setFloodPoints([]);
  const handleRunFloodFill = () => setManualTrigger((prev) => prev + 1);

  const sidebarContent = (
    <Stack gap={6} className="pb-4">
      <Workbench.Header title="MonoRemover" />

      {/* Единый узел ввода-вывода */}
      <SidebarIO
        onFilesSelected={handleFilesSelected}
        accept="image/*"
        dropLabel="Загрузить изображение"
        hasFiles={!!originalUrl}
        onDownload={handleDownload}
        downloadLabel="Скачать PNG"
      />

      {originalUrl && (
        <Stack gap={6} className="animate-fade-in">
          <ControlSection title="Режим">
            <ToggleGroup
              type="single"
              value={processingMode}
              gridCols={2}
              onValueChange={(val) => {
                if (val) setProcessingMode(val as ProcessingMode);
              }}
            >
              <ToggleGroupItem value="remove">Убрать цвет</ToggleGroupItem>
              <ToggleGroupItem value="keep">Оставить цвет</ToggleGroupItem>
              <ToggleGroupItem
                value="flood-clear"
                fullWidth
                className="flex items-center justify-center gap-2"
              >
                Заливка невидимостью
              </ToggleGroupItem>
            </ToggleGroup>
          </ControlSection>

          <ControlSection>
            <Stack gap={2}>
              <Group gap={3}>
                <div className="group relative h-8 w-8 flex-shrink-0 cursor-crosshair overflow-hidden rounded border bg-white dark:border-zinc-700">
                  <Image
                    src={originalUrl}
                    alt="picker"
                    fill
                    className="object-cover"
                    onClick={handleEyedropper}
                    unoptimized
                  />
                </div>
                <Group
                  gap={2}
                  className="flex-1 rounded border bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <ColorInput value={targetColor} onChange={setTargetColor} size="sm" />
                  <Stack gap={0}>
                    <Typography.Text variant="label" className="opacity-70">
                      Цель (Фон)
                    </Typography.Text>
                    <Typography.Text className="font-mono text-xs font-bold uppercase">
                      {targetColor}
                    </Typography.Text>
                  </Stack>
                </Group>
              </Group>

              <Group gap={3}>
                <div className="h-8 w-8 flex-shrink-0" />
                <Group
                  gap={2}
                  className="flex-1 rounded border bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  <ColorInput value={contourColor} onChange={setContourColor} size="sm" />
                  <Stack gap={0}>
                    <Typography.Text variant="label" className="opacity-70">
                      Контур / Окрас
                    </Typography.Text>
                    <Typography.Text className="font-mono text-xs font-bold uppercase">
                      {contourColor}
                    </Typography.Text>
                  </Stack>
                </Group>
              </Group>
            </Stack>
          </ControlSection>

          <ControlSection>
            <Slider
              label="Допуск (%)"
              value={tolerances[processingMode] ?? 0}
              onChange={(val) => setTolerances((p) => ({ ...p, [processingMode]: val }))}
              min={0}
              max={100}
            />
            {processingMode !== 'flood-clear' && (
              <Slider
                label="Сглаживание"
                value={smoothness}
                onChange={setSmoothness}
                min={0}
                max={50}
              />
            )}
            <Separator className="my-2" />
            <Stack gap={4}>
              <Typography.Text variant="label">Удаление ореолов</Typography.Text>
              <Slider
                label="Сжатие (Choke)"
                value={edgeChoke}
                onChange={setEdgeChoke}
                min={0}
                max={5}
                step={1}
                className="mb-0"
              />
              <Slider
                label="Смягчение (Blur)"
                value={edgeBlur}
                onChange={setEdgeBlur}
                min={0}
                max={5}
                className="mb-0"
              />
              <Slider
                label="Окрашивание (Paint)"
                value={edgePaint}
                onChange={setEdgePaint}
                min={0}
                max={5}
                step={1}
                className="mb-0"
              />
            </Stack>
          </ControlSection>

          {processingMode === 'flood-clear' && (
            <StatusBox title={`Точки: ${floodPoints.length}`}>
              <ActionGroup>
                <Button
                  onClick={removeLastPoint}
                  disabled={floodPoints.length === 0}
                  className="flex-1"
                  variant="secondary"
                  size="xs"
                >
                  Отменить
                </Button>
                <Button
                  onClick={clearAllPoints}
                  disabled={floodPoints.length === 0}
                  variant="destructive"
                  className="flex-1"
                  size="xs"
                >
                  Сбросить
                </Button>
              </ActionGroup>
              <Button
                onClick={handleRunFloodFill}
                disabled={floodPoints.length === 0 || isProcessing}
                variant="default" // Синяя по умолчанию
                className="mt-2 w-full font-bold tracking-wide uppercase"
              >
                {isProcessing ? 'Обработка...' : 'Принудительно обновить'}
              </Button>
            </StatusBox>
          )}
        </Stack>
      )}
    </Stack>
  );

  return (
    <Workbench.Root>
      <Workbench.Sidebar>{sidebarContent}</Workbench.Sidebar>
      <Workbench.Stage>
        <div className="relative h-full w-full">
          <WorkbenchCanvas
            ref={workspaceRef}
            isLoading={isProcessing || isMetadataLoading}
            contentWidth={imgW}
            contentHeight={imgH}
            shadowOverlayOpacity={originalUrl ? 0.8 : 0}
            showTransparencyGrid={true}
            placeholder={
              !originalUrl ? (
                <FileDropzonePlaceholder onUpload={(files) => handleFilesSelected(files)} />
              ) : null
            }
          >
            <EngineRoom>
              <canvas ref={sourceCanvasRef} />
            </EngineRoom>

            <canvas
              ref={previewCanvasRef}
              className="block select-none"
              onPointerDown={handleImagePointerDown}
              style={{
                width: '100%',
                height: '100%',
                imageRendering: 'pixelated',
                cursor: processingMode === 'flood-clear' ? 'crosshair' : 'default',
                display: originalUrl ? 'block' : 'none',
              }}
            />

            {processingMode === 'flood-clear' &&
              floodPoints.map((pt, i) => (
                <CanvasMovable
                  key={i}
                  x={pt.x}
                  y={pt.y}
                  scale={getScale}
                  onMove={(pos) => handlePointMove(i, pos)}
                  className="z-20"
                >
                  {() => (
                    <div style={{ transform: 'translate(-50%, -50%)' }}>
                      <div className="h-2.5 w-2.5 rounded-full border border-white bg-red-500 shadow-[0_0_2px_rgba(0,0,0,0.8)] transition-all" />
                    </div>
                  )}
                </CanvasMovable>
              ))}
          </WorkbenchCanvas>
        </div>
      </Workbench.Stage>
    </Workbench.Root>
  );
}
