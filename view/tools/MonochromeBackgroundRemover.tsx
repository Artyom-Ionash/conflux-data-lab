'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { downloadDataUrl, getTopLeftPixelColor, loadImage } from '@/core/browser/canvas';
import { hexToRgb, invertHex, rgbToHex } from '@/core/primitives/colors';
import { useDebounceEffect } from '@/core/react/hooks/use-debounce';
import { useMediaSession } from '@/core/react/hooks/use-media-session';
import { useWorker } from '@/core/react/hooks/use-worker';
import type {
  ProcessingMode,
  WorkerPayload,
  WorkerResponse,
} from '@/lib/graphics/processing/background-engine.worker';
import type { Point } from '@/lib/graphics/processing/imaging';
import { CanvasMovable, useCanvasRef } from '@/view/ui/canvas/Canvas';
import { WorkbenchFrame } from '@/view/ui/canvas/WorkbenchFrame';
import { ActionGroup } from '@/view/ui/container/ActionGroup';
import { Section } from '@/view/ui/container/Section';
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

  const session = useMediaSession(selectedFile, 'image');
  const imgW = session.dimensions?.width;
  const imgH = session.dimensions?.height;

  const [targetColor, setTargetColor] = useState(DEFAULT_SETTINGS.targetColor);
  const [contourColor, setContourColor] = useState(DEFAULT_SETTINGS.contourColor);

  // Логика определения цвета фона (специфична для этого инструмента)
  useEffect(() => {
    if (!session.url) return;

    void loadImage(session.url).then((img) => {
      const { r, g, b } = getTopLeftPixelColor(img);
      const hex = rgbToHex(r, g, b);
      setTargetColor(hex);
      setContourColor(invertHex(hex));
    });
  }, [session.url]);

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

  // Отрисовка исходного изображения на канвас
  useEffect(() => {
    if (!session.url || !imgW || !imgH) return;

    if (sourceCanvasRef.current) {
      sourceCanvasRef.current.width = imgW;
      sourceCanvasRef.current.height = imgH;
      const ctx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
      const img = new window.Image();
      img.onload = () => {
        ctx?.drawImage(img, 0, 0);
        if (previewCanvasRef.current) {
          previewCanvasRef.current.width = img.width;
          previewCanvasRef.current.height = img.height;
          previewCanvasRef.current.getContext('2d')?.drawImage(img, 0, 0);
        }
        workspaceRef.current?.resetView(img.width, img.height);
      };
      img.src = session.url;
    }
  }, [session.url, imgW, imgH, workspaceRef]);

  const processImage = useCallback(() => {
    if (!session.url || !sourceCanvasRef.current) return;
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
    session.url,
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
      if (session.url) void processImage();
    },
    [session.url, processImage],
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
    if (file) setSelectedFile(file);
  };

  const handleDownload = () => {
    if (previewCanvasRef.current) {
      downloadDataUrl(previewCanvasRef.current.toDataURL('image/png'), DOWNLOAD_FILENAME);
    }
  };

  const getRelativeImageCoords = (clientX: number, clientY: number): Point | null => {
    if (!workspaceRef.current || !imgW || !imgH) return null;
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
        hasFiles={!!session.url}
        onDownload={handleDownload}
        downloadLabel="Скачать PNG"
      />

      {session.url && (
        <Stack gap={6} className="animate-fade-in">
          <Section title="Режим">
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
          </Section>

          <Section>
            <Stack gap={2}>
              <Group gap={3}>
                <div className="group relative h-8 w-8 flex-shrink-0 cursor-crosshair overflow-hidden rounded border bg-white dark:border-zinc-700">
                  <Image
                    src={session.url}
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
          </Section>

          <Section>
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
          </Section>

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
        {!session.url ? (
          <FileDropzonePlaceholder
            onUpload={(files) => handleFilesSelected(files)}
            multiple={false}
            accept="image/*"
            title="Загрузите изображение"
            subTitle="Для изображений с одноцветным фоном"
          />
        ) : (
          <div className="relative h-full w-full">
            <WorkbenchFrame
              ref={workspaceRef}
              isLoading={isProcessing || session.isLoading}
              contentWidth={imgW}
              contentHeight={imgH}
              shadowOverlayOpacity={0.8}
              showTransparencyGrid={true}
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
                  display: session.url ? 'block' : 'none',
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
            </WorkbenchFrame>
          </div>
        )}
      </Workbench.Stage>
    </Workbench.Root>
  );
}
