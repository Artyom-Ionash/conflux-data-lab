// conflux-data-lab/app/components/tools/monochrome-remover/MonochromeBackgroundRemover.tsx

'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useObjectUrl } from '@/lib/core/hooks/use-object-url';
import { hexToRgb, invertHex, rgbToHex } from '@/lib/core/utils/colors';
import { downloadDataUrl, getTopLeftPixelColor, loadImage } from '@/lib/core/utils/media';
import type { Point } from '@/lib/modules/graphics/processing/filters';
import type {
  ProcessingMode,
  WorkerPayload,
  WorkerResponse,
} from '@/lib/modules/graphics/processing/processor.worker';

import { Canvas, CanvasRef } from '../../primitives/Canvas';
import { ColorInput } from '../../primitives/ColorInput';
import { ControlLabel, ControlSection } from '../../primitives/ControlSection';
import { FileDropzone, FileDropzonePlaceholder } from '../../primitives/FileDropzone';
import { Slider } from '../../primitives/Slider';
import { ToggleGroup, ToggleGroupItem } from '../../primitives/ToggleGroup';
import { ToolLayout } from '../ToolLayout';

// ... (CONSTANTS без изменений)
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
  // ... (State без изменений)
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
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new Worker(
      new URL('@/lib/modules/graphics/processing/processor.worker.ts', import.meta.url)
    );

    workerRef.current.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { processedData, error } = e.data;

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
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

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
    if (!originalUrl || !sourceCanvasRef.current || !workerRef.current) return;

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
        tolerance: tolerances[processingMode],
        smoothness,
        edgeChoke,
        edgeBlur,
        edgePaint,
        maxRgbDistance: MAX_RGB_DISTANCE,
        floodPoints: [...floodPoints],
      },
    };

    workerRef.current.postMessage(payload, [imageData.data.buffer]);
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
  ]);

  useEffect(() => {
    if (originalUrl) {
      requestAnimationFrame(() => {
        loadOriginalToCanvas(originalUrl);
      });
    }
  }, [originalUrl, loadOriginalToCanvas]);

  useEffect(() => {
    if (!originalUrl) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      requestAnimationFrame(() => processImage());
    }, DEBOUNCE_DELAY);
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [originalUrl, processImage]);

  useEffect(() => {
    if (manualTrigger > 0 && processingMode === 'flood-clear') {
      const timer = setTimeout(() => {
        processImage();
      }, 0);
      return () => clearTimeout(timer);
    }
    // FIX: Явный return undefined, чтобы TS не ругался на отсутствие возвращаемого значения во всех путях
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
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
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

    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * sourceCanvasRef.current.width;
    const y = ((e.clientY - rect.top) / rect.height) * sourceCanvasRef.current.height;

    const ctx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const p = ctx.getImageData(x, y, 1, 1).data;
      // FIX: Используем ?? 0, так как массив может вернуть undefined
      setTargetColor(rgbToHex(p[OFFSET_R] ?? 0, p[OFFSET_G] ?? 0, p[OFFSET_B] ?? 0));
    }
  };

  const removeLastPoint = () => setFloodPoints((prev) => prev.slice(0, -1));
  const clearAllPoints = () => setFloodPoints([]);
  const handleRunFloodFill = () => setManualTrigger((prev) => prev + 1);

  // ... (JSX render без изменений)
  const sidebarContent = (
    <div className="flex flex-col gap-6 pb-4">
      {/* ... */}
      {originalUrl && (
        <div className="animate-fade-in space-y-6">
          {/* ... */}
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
                {/* ... */}
              </div>
              {/* ... */}
            </div>
          </ControlSection>
          {/* ... */}
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout title="MonoRemover" sidebar={sidebarContent}>
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
    </ToolLayout>
  );
}
