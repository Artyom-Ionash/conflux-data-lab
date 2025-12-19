'use client';

import Image from 'next/image';
import Link from 'next/link'; // Добавлен для хедера
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useDebounceEffect } from '@/lib/core/hooks/use-debounce-effect';
import { useObjectUrl } from '@/lib/core/hooks/use-object-url';
import { useWorker } from '@/lib/core/hooks/use-worker';
import { hexToRgb, invertHex, rgbToHex } from '@/lib/core/utils/colors';
import { downloadDataUrl, getTopLeftPixelColor, loadImage } from '@/lib/core/utils/media';
import type {
  ProcessingMode,
  WorkerPayload,
  WorkerResponse,
} from '@/lib/modules/graphics/processing/background-engine.worker';
import type { Point } from '@/lib/modules/graphics/processing/imaging';
import type { CanvasRef } from '@/view/ui/Canvas';
import { Canvas } from '@/view/ui/Canvas';
import { ColorInput } from '@/view/ui/ColorInput';
import { ControlLabel, ControlSection } from '@/view/ui/ControlSection';
import { FileDropzone, FileDropzonePlaceholder } from '@/view/ui/FileDropzone';
import { Slider } from '@/view/ui/Slider';
import { ToggleGroup, ToggleGroupItem } from '@/view/ui/ToggleGroup';
import { Workbench } from '@/view/ui/Workbench'; // Обновленный импорт

// --- CONSTANTS ---
// ... (Константы остаются без изменений)
const DEBOUNCE_DELAY = 50;
const VIEW_RESET_DELAY = 50;
const MOUSE_BUTTON_LEFT = 0;
const RGB_MAX = 255;
const MAX_RGB_DISTANCE = Math.sqrt(3 * RGB_MAX ** 2);
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
  // ... (Вся логика хуков и стейта остается без изменений) ...
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const originalUrl = useObjectUrl(selectedFile);

  const [imgDimensions, setImgDimensions] = useState({ w: 0, h: 0 });
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
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);

  const workspaceRef = useRef<CanvasRef>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const createWorker = useCallback(
    () =>
      new Worker(
        new URL('@/lib/modules/graphics/processing/background-engine.worker.ts', import.meta.url)
      ),
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

  const loadOriginalToCanvas = useCallback(async (url: string) => {
    try {
      const img = await loadImage(url);
      setImgDimensions({ w: img.width, h: img.height });
      if (sourceCanvasRef.current) {
        sourceCanvasRef.current.width = img.width;
        sourceCanvasRef.current.height = img.height;
        const ctx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
        ctx?.drawImage(img, 0, 0);
      }
      if (previewCanvasRef.current) {
        previewCanvasRef.current.width = img.width;
        previewCanvasRef.current.height = img.height;
        const ctx = previewCanvasRef.current.getContext('2d');
        ctx?.drawImage(img, 0, 0);
      }
      setTimeout(() => workspaceRef.current?.resetView(img.width, img.height), VIEW_RESET_DELAY);
    } catch (e) {
      console.error(e);
    }
  }, []);

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

  useEffect(() => {
    if (originalUrl) {
      requestAnimationFrame(() => {
        void loadOriginalToCanvas(originalUrl);
      });
    }
  }, [originalUrl, loadOriginalToCanvas]);

  useDebounceEffect(
    () => {
      if (originalUrl) {
        requestAnimationFrame(() => processImage());
      }
    },
    [originalUrl, processImage],
    DEBOUNCE_DELAY
  );

  useEffect(() => {
    if (manualTrigger > 0 && processingMode === 'flood-clear') {
      const timer = setTimeout(() => {
        processImage();
      }, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [manualTrigger, processingMode, processImage]);

  const handleFilesSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFloodPoints([]);
    setSelectedFile(file);
    try {
      const tempUrl = URL.createObjectURL(file);
      const img = await loadImage(tempUrl);
      const { r, g, b } = getTopLeftPixelColor(img);
      const hex = rgbToHex(r, g, b);
      setTargetColor(hex);
      setContourColor(invertHex(hex));
      URL.revokeObjectURL(tempUrl);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownload = () => {
    if (previewCanvasRef.current) {
      downloadDataUrl(previewCanvasRef.current.toDataURL('image/png'), DOWNLOAD_FILENAME);
    }
  };

  const getRelativeImageCoords = (clientX: number, clientY: number): Point | null => {
    if (!workspaceRef.current || !imgDimensions.w) return null;
    const world = workspaceRef.current.screenToWorld(clientX, clientY);
    const x = Math.floor(world.x);
    const y = Math.floor(world.y);
    if (x >= 0 && x < imgDimensions.w && y >= 0 && y < imgDimensions.h) return { x, y };
    return null;
  };

  const handlePointPointerDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== MOUSE_BUTTON_LEFT) return;
    setDraggingPointIndex(index);
    if (e.target instanceof HTMLElement) {
      e.target.setPointerCapture(e.pointerId);
    }
  };

  const handleImagePointerDown = (e: React.PointerEvent) => {
    if (e.button !== MOUSE_BUTTON_LEFT) return;
    if (processingMode === 'flood-clear') {
      const coords = getRelativeImageCoords(e.clientX, e.clientY);
      if (coords) setFloodPoints((prev) => [...prev, coords]);
    }
  };

  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    if (draggingPointIndex !== null) {
      const newCoords = getRelativeImageCoords(e.clientX, e.clientY);
      if (newCoords) {
        setFloodPoints((prev) => {
          const next = [...prev];
          next[draggingPointIndex] = newCoords;
          return next;
        });
      }
    }
  };

  const handleGlobalPointerUp = () => {
    if (draggingPointIndex !== null) setDraggingPointIndex(null);
  };

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

  // --- RENDER ---

  const sidebarContent = (
    <div className="flex flex-col gap-6 pb-4">
      {/* Header */}
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
          </svg>{' '}
          На главную
        </Link>
        <h2 className="text-xl font-bold">MonoRemover</h2>
      </div>

      <div className="space-y-2">
        <ControlLabel>Исходник</ControlLabel>
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          label="Загрузить изображение"
        />
      </div>

      {originalUrl && (
        <div className="animate-fade-in space-y-6">
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

            {processingMode === 'flood-clear' && (
              <div className="rounded border border-blue-100 bg-blue-50 p-2 text-[10px] leading-tight text-blue-600 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                1. Кликните на холст, чтобы поставить точки.
                <br />
                2. Точки можно <b>перетаскивать</b>.<br />
                3. Заливка обновляется <b>автоматически</b>.
              </div>
            )}
          </ControlSection>

          <ControlSection>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
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
                <div className="flex flex-1 items-center gap-2 rounded border bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800">
                  <ColorInput value={targetColor} onChange={setTargetColor} size="sm" />
                  <div className="flex flex-col">
                    <ControlLabel className="text-[10px]! opacity-70">Цель (Фон)</ControlLabel>
                    <span className="font-mono text-xs font-bold uppercase">{targetColor}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-8 w-8 flex-shrink-0" />
                <div className="flex flex-1 items-center gap-2 rounded border bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800">
                  <ColorInput value={contourColor} onChange={setContourColor} size="sm" />
                  <div className="flex flex-col">
                    <ControlLabel className="text-[10px]! opacity-70">Контур / Окрас</ControlLabel>
                    <span className="font-mono text-xs font-bold uppercase">{contourColor}</span>
                  </div>
                </div>
              </div>
            </div>
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
            <div className="border-t border-zinc-200 pt-2 dark:border-zinc-700/50">
              <div className="mb-3 flex justify-between text-xs">
                <ControlLabel>Удаление ореолов</ControlLabel>
              </div>
              <Slider
                label="Сжатие (Choke)"
                value={edgeChoke}
                onChange={setEdgeChoke}
                min={0}
                max={5}
                step={1}
              />
              <Slider
                label="Смягчение (Blur)"
                value={edgeBlur}
                onChange={setEdgeBlur}
                min={0}
                max={5}
                step={1}
              />
              <Slider
                label="Окрашивание (Paint)"
                value={edgePaint}
                onChange={setEdgePaint}
                min={0}
                max={5}
                step={1}
              />
            </div>
          </ControlSection>

          {processingMode === 'flood-clear' && (
            <div className="space-y-3 rounded-lg border border-blue-100 bg-blue-50 p-3 dark:border-blue-900/30 dark:bg-blue-900/10">
              <div className="flex items-center justify-between text-xs font-bold text-blue-800 dark:text-blue-200">
                <span>Точки: {floodPoints.length}</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={removeLastPoint}
                  disabled={floodPoints.length === 0}
                  className="flex-1 rounded border border-zinc-200 bg-white py-2 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  Отменить
                </button>
                <button
                  onClick={clearAllPoints}
                  disabled={floodPoints.length === 0}
                  className="flex-1 rounded border border-zinc-200 bg-white py-2 text-xs hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800"
                >
                  Сбросить
                </button>
              </div>
              <button
                onClick={handleRunFloodFill}
                disabled={floodPoints.length === 0 || isProcessing}
                className="w-full rounded bg-blue-600 py-2.5 text-xs font-bold tracking-wide text-white uppercase shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProcessing ? 'Обработка...' : 'Принудительно обновить'}
              </button>
            </div>
          )}

          <button
            onClick={handleDownload}
            disabled={!originalUrl}
            className="w-full rounded bg-zinc-900 py-3 text-sm font-bold text-white shadow transition hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Скачать
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Workbench.Root>
      <Workbench.Sidebar>{sidebarContent}</Workbench.Sidebar>
      <Workbench.Stage>
        <div
          className="relative h-full w-full"
          onPointerMove={handleGlobalPointerMove}
          onPointerUp={handleGlobalPointerUp}
        >
          <Canvas
            ref={workspaceRef}
            isLoading={isProcessing}
            contentWidth={imgDimensions.w}
            contentHeight={imgDimensions.h}
            shadowOverlayOpacity={originalUrl ? 0.8 : 0}
            showTransparencyGrid={true}
            placeholder={
              !originalUrl ? (
                <FileDropzonePlaceholder onUpload={(files) => handleFilesSelected(files)} />
              ) : null
            }
          >
            <canvas ref={sourceCanvasRef} className="hidden" />
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
                <div
                  key={i}
                  onPointerDown={(e) => handlePointPointerDown(e, i)}
                  className={`absolute z-20 cursor-grab hover:brightness-125 active:cursor-grabbing ${draggingPointIndex === i ? 'brightness-150' : ''}`}
                  style={{
                    left: pt.x,
                    top: pt.y,
                    width: '10px',
                    height: '10px',
                    transform: 'translate(-50%, -50%) scale(calc(1 / var(--canvas-scale)))',
                  }}
                >
                  <div className="h-full w-full rounded-full border border-white bg-red-500 shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                </div>
              ))}
          </Canvas>
        </div>
      </Workbench.Stage>
    </Workbench.Root>
  );
}
