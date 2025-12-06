'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Canvas, CanvasRef } from '../../ui/Canvas';
import { FileDropzone } from '../../ui/FileDropzone';
import { ToolLayout } from '../ToolLayout';
import { Slider } from '../../ui/Slider';

// --- CONSTANTS & CONFIG ---
const DEBOUNCE_DELAY = 50; // ms
const VIEW_RESET_DELAY = 50; // ms
const MAX_RGB_DISTANCE = Math.sqrt(3 * 255 ** 2); // ~441.67

const DEFAULT_SETTINGS = {
  targetColor: '#ffffff',
  contourColor: '#000000',
  tolerance: 20,
  smoothness: 10,
  edgeChoke: 0,
  edgeBlur: 0,
  edgePaint: 0,
};

// --- HELPERS ---
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

function invertHex(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000';
  return rgbToHex(255 - rgb.r, 255 - rgb.g, 255 - rgb.b);
}

type ProcessingMode = 'remove' | 'keep' | 'flood-clear';

interface Point {
  x: number;
  y: number;
}

export function MonochromeBackgroundRemover() {
  // --- STATE ---
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [imgDimensions, setImgDimensions] = useState({ w: 0, h: 0 });

  const [targetColor, setTargetColor] = useState(DEFAULT_SETTINGS.targetColor);
  const [contourColor, setContourColor] = useState(DEFAULT_SETTINGS.contourColor);

  const [tolerances, setTolerances] = useState<Record<ProcessingMode, number>>({
    'remove': DEFAULT_SETTINGS.tolerance,
    'keep': DEFAULT_SETTINGS.tolerance,
    'flood-clear': DEFAULT_SETTINGS.tolerance
  });
  const [smoothness, setSmoothness] = useState(DEFAULT_SETTINGS.smoothness);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('remove');

  // Tools
  const [edgeChoke, setEdgeChoke] = useState(DEFAULT_SETTINGS.edgeChoke);
  const [edgeBlur, setEdgeBlur] = useState(DEFAULT_SETTINGS.edgeBlur);
  const [edgePaint, setEdgePaint] = useState(DEFAULT_SETTINGS.edgePaint);

  const [floodPoints, setFloodPoints] = useState<Point[]>([]);
  const [manualTrigger, setManualTrigger] = useState(0);

  // UI
  const [isProcessing, setIsProcessing] = useState(false);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);

  // --- REFS ---
  const workspaceRef = useRef<CanvasRef>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // --- LOGIC ---

  const loadOriginalToCanvas = (url: string) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {
      setImgDimensions({ w: img.width, h: img.height });

      // Init Source Canvas
      if (sourceCanvasRef.current) {
        sourceCanvasRef.current.width = img.width;
        sourceCanvasRef.current.height = img.height;
        const ctx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
        ctx?.drawImage(img, 0, 0);
      }

      // Init Preview Canvas
      if (previewCanvasRef.current) {
        previewCanvasRef.current.width = img.width;
        previewCanvasRef.current.height = img.height;
        const ctx = previewCanvasRef.current.getContext('2d');
        ctx?.drawImage(img, 0, 0);
      }

      setTimeout(() => workspaceRef.current?.resetView(img.width, img.height), VIEW_RESET_DELAY);
      processImage();
    };
  };

  const processImage = useCallback(() => {
    if (!originalUrl || !sourceCanvasRef.current || !previewCanvasRef.current) return;

    setIsProcessing(true);

    // Use timeout to allow UI update (loader)
    setTimeout(() => {
      const sourceCtx = sourceCanvasRef.current!.getContext('2d', { willReadFrequently: true });
      const previewCtx = previewCanvasRef.current!.getContext('2d');

      if (!sourceCtx || !previewCtx) return;

      const width = sourceCanvasRef.current!.width;
      const height = sourceCanvasRef.current!.height;
      const imageData = sourceCtx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const targetRGB = hexToRgb(targetColor);
      const contourRGB = hexToRgb(contourColor);

      if (!targetRGB || !contourRGB) {
        setIsProcessing(false);
        return;
      }

      const tolVal = (tolerances[processingMode] / 100) * MAX_RGB_DISTANCE;
      const smoothVal = (smoothness / 100) * MAX_RGB_DISTANCE;

      const getDist = (i: number, rgb: { r: number, g: number, b: number }) =>
        Math.sqrt((data[i] - rgb.r) ** 2 + (data[i + 1] - rgb.g) ** 2 + (data[i + 2] - rgb.b) ** 2);

      const alphaChannel = new Uint8Array(width * height);

      // --- ALGORITHM START ---
      if (processingMode === 'flood-clear') {
        if (floodPoints.length === 0) {
          previewCtx.putImageData(imageData, 0, 0);
          setIsProcessing(false);
          return;
        }

        alphaChannel.fill(255);
        const visited = new Uint8Array(width * height);

        floodPoints.forEach(pt => {
          const startX = Math.floor(pt.x);
          const startY = Math.floor(pt.y);
          if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

          const stack = [startX, startY];
          while (stack.length) {
            const y = stack.pop()!;
            const x = stack.pop()!;
            const idx = y * width + x;

            if (visited[idx]) continue;
            visited[idx] = 1;

            // Stop at contour color within tolerance
            if (getDist(idx * 4, contourRGB) <= tolVal) continue;

            alphaChannel[idx] = 0;

            if (x > 0) stack.push(x - 1, y);
            if (x < width - 1) stack.push(x + 1, y);
            if (y > 0) stack.push(x, y - 1);
            if (y < height - 1) stack.push(x, y + 1);
          }
        });
      } else {
        // Standard linear scan (Remove / Keep)
        for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
          const dist = getDist(i, targetRGB);
          let alpha = 255;

          if (processingMode === 'remove') {
            if (dist <= tolVal) alpha = 0;
            else if (dist <= tolVal + smoothVal && smoothVal > 0) {
              alpha = Math.floor(255 * ((dist - tolVal) / smoothVal));
            }
          } else if (processingMode === 'keep') {
            if (dist > tolVal + smoothVal) alpha = 0;
            else if (dist > tolVal && smoothVal > 0) {
              alpha = Math.floor(255 * (1 - ((dist - tolVal) / smoothVal)));
            }
          }
          alphaChannel[idx] = alpha;
        }
      }

      // --- POST-PROCESSING ---

      // 1. Choke (Erosion)
      if (edgeChoke > 0) {
        const eroded = new Uint8Array(alphaChannel);
        const r = edgeChoke;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = y * width + x;
            if (alphaChannel[i] === 0) continue;

            let hit = false;
            // Check neighbors
            loop: for (let ky = -r; ky <= r; ky++) {
              for (let kx = -r; kx <= r; kx++) {
                const ny = y + ky;
                const nx = x + kx;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height && alphaChannel[ny * width + nx] === 0) {
                  hit = true;
                  break loop;
                }
              }
            }
            if (hit) eroded[i] = 0;
          }
        }
        alphaChannel.set(eroded);
      }

      // 2. Blur
      if (edgeBlur > 0) {
        const blurred = new Uint8Array(alphaChannel);
        const r = Math.max(1, edgeBlur);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let sum = 0, count = 0;
            for (let ky = -r; ky <= r; ky++) {
              for (let kx = -r; kx <= r; kx++) {
                const ny = y + ky;
                const nx = x + kx;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                  sum += alphaChannel[ny * width + nx];
                  count++;
                }
              }
            }
            blurred[y * width + x] = Math.floor(sum / count);
          }
        }
        alphaChannel.set(blurred);
      }

      // 3. Paint Edges
      if (edgePaint > 0) {
        const r = edgePaint;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = y * width + x;
            if (alphaChannel[i] === 0) continue;

            let isEdge = false;
            loop2: for (let ky = -r; ky <= r; ky++) {
              for (let kx = -r; kx <= r; kx++) {
                const ny = y + ky;
                const nx = x + kx;
                if (nx >= 0 && nx < width && ny >= 0 && ny < height && alphaChannel[ny * width + nx] === 0) {
                  isEdge = true;
                  break loop2;
                }
              }
            }
            if (isEdge) {
              const p = i * 4;
              data[p] = contourRGB.r;
              data[p + 1] = contourRGB.g;
              data[p + 2] = contourRGB.b;
            }
          }
        }
      }

      // Apply Alpha Channel to output data
      for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
        data[i + 3] = alphaChannel[idx];
      }

      previewCtx.putImageData(imageData, 0, 0);
      setIsProcessing(false);
    }, 10);
  }, [originalUrl, targetColor, contourColor, tolerances, smoothness, processingMode, floodPoints, edgeChoke, edgeBlur, edgePaint]);

  // --- EFFECTS ---

  // Debounce processing to avoid freezing UI on every slider move
  useEffect(() => {
    if (!originalUrl) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      processImage();
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [originalUrl, targetColor, contourColor, tolerances, smoothness, processingMode, floodPoints, edgeChoke, edgeBlur, edgePaint]);

  // Manual trigger for Flood Fill force update
  useEffect(() => {
    if (manualTrigger > 0 && processingMode === 'flood-clear') {
      processImage();
    }
  }, [manualTrigger]);

  // --- HANDLERS ---

  const handleFilesSelected = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);
    setFloodPoints([]);
    loadOriginalToCanvas(url);

    // Auto-detect color from top-left pixel
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 1;
      c.height = 1;
      const cx = c.getContext('2d');
      if (cx) {
        cx.drawImage(img, 0, 0);
        const p = cx.getImageData(0, 0, 1, 1).data;
        const hex = rgbToHex(p[0], p[1], p[2]);
        setTargetColor(hex);
        setContourColor(invertHex(hex));
      }
    };
  };

  const handleDownload = () => {
    if (previewCanvasRef.current) {
      const link = document.createElement('a');
      link.download = 'removed_bg.png';
      link.href = previewCanvasRef.current.toDataURL('image/png');
      link.click();
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

  // Point Interaction (Flood Fill)
  const handlePointPointerDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0) return; // Only Left Click
    setDraggingPointIndex(index);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleImagePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if (processingMode === 'flood-clear') {
      const coords = getRelativeImageCoords(e.clientX, e.clientY);
      if (coords) setFloodPoints(prev => [...prev, coords]);
    }
  };

  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    if (draggingPointIndex !== null) {
      const newCoords = getRelativeImageCoords(e.clientX, e.clientY);
      if (newCoords) {
        setFloodPoints(prev => {
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
    const x = (e.clientX - rect.left) / rect.width * sourceCanvasRef.current.width;
    const y = (e.clientY - rect.top) / rect.height * sourceCanvasRef.current.height;

    const ctx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const p = ctx.getImageData(x, y, 1, 1).data;
      setTargetColor(rgbToHex(p[0], p[1], p[2]));
    }
  };

  const removeLastPoint = () => setFloodPoints(prev => prev.slice(0, -1));
  const clearAllPoints = () => setFloodPoints([]);
  const handleRunFloodFill = () => setManualTrigger(prev => prev + 1);

  // --- RENDER ---

  const sidebarContent = (
    <div className="flex flex-col gap-6 pb-4">
      {/* 1. File Input */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase text-zinc-400">Исходник</label>
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          label="Загрузить изображение"
        />
      </div>

      {originalUrl && (
        <div className="space-y-6 animate-fade-in">

          {/* 2. Mode Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase text-zinc-400">Режим</label>
            <div className="flex flex-col gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
              <div className="grid grid-cols-2 gap-1">
                <button
                  onClick={() => setProcessingMode('remove')}
                  className={`text-xs font-medium py-2 rounded-md transition-all ${processingMode === 'remove' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                >
                  Убрать цвет
                </button>
                <button
                  onClick={() => setProcessingMode('keep')}
                  className={`text-xs font-medium py-2 rounded-md transition-all ${processingMode === 'keep' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                >
                  Оставить цвет
                </button>
              </div>
              <button
                onClick={() => setProcessingMode('flood-clear')}
                className={`text-xs font-medium py-2 rounded-md transition-all flex items-center justify-center gap-2 ${processingMode === 'flood-clear' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              >
                Заливка невидимостью
              </button>
            </div>
            {processingMode === 'flood-clear' && (
              <div className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-100 dark:border-blue-800 leading-tight">
                1. Кликните на холст, чтобы поставить точки.<br />
                2. Точки можно <b>перетаскивать</b>.<br />
                3. Заливка обновляется <b>автоматически</b>.
              </div>
            )}
          </div>

          {/* 3. Color Pickers */}
          <div className="space-y-2">
            <div className="flex flex-col gap-2">
              {/* Target Color */}
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 rounded border cursor-crosshair overflow-hidden relative group dark:border-zinc-700 flex-shrink-0 bg-white">
                  <img src={originalUrl} className="w-full h-full object-cover" onClick={handleEyedropper} alt="picker" />
                </div>
                <div className="flex-1 flex items-center gap-2 p-2 border rounded bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700">
                  <input type="color" value={targetColor} onChange={e => setTargetColor(e.target.value)} className="w-6 h-6 bg-transparent border-none cursor-pointer" />
                  <div className="flex flex-col">
                    <span className="font-bold text-[10px] uppercase text-zinc-500">Цель (Фон)</span>
                    <span className="font-mono text-xs font-bold uppercase">{targetColor}</span>
                  </div>
                </div>
              </div>

              {/* Contour Color */}
              <div className="flex gap-3 items-center">
                <div className="w-8 h-8 flex-shrink-0" />
                <div className="flex-1 flex items-center gap-2 p-2 border rounded bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700">
                  <input type="color" value={contourColor} onChange={e => setContourColor(e.target.value)} className="w-6 h-6 bg-transparent border-none cursor-pointer" />
                  <div className="flex flex-col">
                    <span className="font-bold text-[10px] uppercase text-zinc-500">Контур / Окрас</span>
                    <span className="font-mono text-xs font-bold uppercase">{contourColor}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Main Sliders */}
          <div className="space-y-4 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
            <Slider
              label="Допуск (%)"
              value={tolerances[processingMode]}
              onChange={(val) => setTolerances(p => ({ ...p, [processingMode]: val }))}
              min={0} max={100}
            />

            {processingMode !== 'flood-clear' && (
              <Slider
                label="Сглаживание"
                value={smoothness}
                onChange={setSmoothness}
                min={0} max={50}
              />
            )}

            {/* 5. Edge Post-processing */}
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700/50">
              <div className="flex justify-between text-xs mb-3">
                <span className="font-bold text-zinc-500 uppercase tracking-wide">Удаление ореолов</span>
              </div>
              <Slider label="Сжатие (Choke)" value={edgeChoke} onChange={setEdgeChoke} min={0} max={5} step={1} />
              <Slider label="Смягчение (Blur)" value={edgeBlur} onChange={setEdgeBlur} min={0} max={5} step={1} />
              <Slider label="Окрашивание (Paint)" value={edgePaint} onChange={setEdgePaint} min={0} max={5} step={1} />
            </div>
          </div>

          {/* 6. Flood Fill Controls */}
          {processingMode === 'flood-clear' && (
            <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
              <div className="flex justify-between items-center text-xs font-bold text-blue-800 dark:text-blue-200">
                <span>Точки: {floodPoints.length}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={removeLastPoint} disabled={floodPoints.length === 0} className="flex-1 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 disabled:opacity-50">
                  Отменить
                </button>
                <button onClick={clearAllPoints} disabled={floodPoints.length === 0} className="flex-1 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded hover:text-red-500 hover:bg-red-50 disabled:opacity-50">
                  Сбросить
                </button>
              </div>
              <button
                onClick={handleRunFloodFill}
                disabled={floodPoints.length === 0 || isProcessing}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs shadow-sm uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'Обработка...' : 'Принудительно обновить'}
              </button>
            </div>
          )}

          {/* 7. Download Button */}
          <button
            onClick={handleDownload}
            disabled={!originalUrl}
            className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded font-bold text-sm shadow hover:opacity-90 transition disabled:opacity-50"
          >
            Скачать
          </button>
        </div>
      )}
    </div>
  );

  return (
    <ToolLayout title="MonoRemover" sidebar={sidebarContent}>
      <div
        className="w-full h-full relative"
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
          placeholder={!originalUrl} // Uses default interactive placeholder
          onUpload={handleFilesSelected} // Connects placeholder to upload logic
        >
          {/* HIDDEN SOURCE CANVAS */}
          <canvas ref={sourceCanvasRef} className="hidden" />

          {/* VISIBLE PREVIEW CANVAS */}
          <canvas
            ref={previewCanvasRef}
            className="block select-none"
            onPointerDown={handleImagePointerDown}
            style={{
              width: '100%',
              height: '100%',
              imageRendering: 'pixelated',
              cursor: processingMode === 'flood-clear' ? 'crosshair' : 'default',
              display: originalUrl ? 'block' : 'none'
            }}
          />

          {/* FLOOD FILL POINTS OVERLAY */}
          {processingMode === 'flood-clear' && floodPoints.map((pt, i) => (
            <div
              key={i}
              onPointerDown={(e) => handlePointPointerDown(e, i)}
              className={`absolute z-20 cursor-grab active:cursor-grabbing hover:brightness-125 ${draggingPointIndex === i ? 'brightness-150' : ''}`}
              style={{
                left: pt.x, top: pt.y, width: '10px', height: '10px',
                transform: 'translate(-50%, -50%) scale(calc(1 / var(--canvas-scale)))',
              }}
            >
              <div className="w-full h-full bg-red-500 border border-white rounded-full shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
            </div>
          ))}
        </Canvas>
      </div>
    </ToolLayout>
  );
}