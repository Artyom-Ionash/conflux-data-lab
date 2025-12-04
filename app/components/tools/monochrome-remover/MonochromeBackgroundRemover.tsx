'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Canvas, CanvasRef } from '../../ui/Canvas';

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
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

  const [targetColor, setTargetColor] = useState('#ffffff');
  const [contourColor, setContourColor] = useState('#000000');
  const [tolerances, setTolerances] = useState<Record<ProcessingMode, number>>({
    'remove': 20, 'keep': 20, 'flood-clear': 20
  });
  const [smoothness, setSmoothness] = useState(10);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('remove');

  // Инструменты
  const [edgeChoke, setEdgeChoke] = useState(0);
  const [edgeBlur, setEdgeBlur] = useState(0);
  const [edgePaint, setEdgePaint] = useState(0);
  const [floodPoints, setFloodPoints] = useState<Point[]>([]);
  const [manualTrigger, setManualTrigger] = useState(0);

  // UI State
  const [isProcessing, setIsProcessing] = useState(false);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);

  // REFS
  const workspaceRef = useRef<CanvasRef>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Canvas Refs:
  // sourceCanvas - хранит оригинал (скрыт)
  // previewCanvas - отображает результат (виден)
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // --- ЭФФЕКТЫ ---

  // 1. Загрузка изображения в Source Canvas
  const loadOriginalToCanvas = (url: string) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => {
      setImgDimensions({ w: img.width, h: img.height });

      // Инициализация Source Canvas
      if (sourceCanvasRef.current) {
        sourceCanvasRef.current.width = img.width;
        sourceCanvasRef.current.height = img.height;
        const ctx = sourceCanvasRef.current.getContext('2d', { willReadFrequently: true });
        ctx?.drawImage(img, 0, 0);
      }

      // Инициализация Preview Canvas (копия оригинала)
      if (previewCanvasRef.current) {
        previewCanvasRef.current.width = img.width;
        previewCanvasRef.current.height = img.height;
        const ctx = previewCanvasRef.current.getContext('2d');
        ctx?.drawImage(img, 0, 0);
      }

      // Сброс зума
      setTimeout(() => workspaceRef.current?.resetView(img.width, img.height), 50);

      // Запуск первой обработки
      processImage();
    };
  };

  // 2. Логика процессинга (Pixel Manipulation)
  const processImage = useCallback(() => {
    if (!originalUrl || !sourceCanvasRef.current || !previewCanvasRef.current) return;

    setIsProcessing(true);

    // Используем setTimeout, чтобы UI успел показать спиннер загрузки
    setTimeout(() => {
      const sourceCtx = sourceCanvasRef.current!.getContext('2d', { willReadFrequently: true });
      const previewCtx = previewCanvasRef.current!.getContext('2d');

      if (!sourceCtx || !previewCtx) return;

      const width = sourceCanvasRef.current!.width;
      const height = sourceCanvasRef.current!.height;

      // Берем данные из Source (быстро благодаря willReadFrequently)
      const imageData = sourceCtx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const targetRGB = hexToRgb(targetColor);
      const contourRGB = hexToRgb(contourColor);

      if (!targetRGB || !contourRGB) { setIsProcessing(false); return; }

      const maxDist = 441.67;
      const currentTolerance = tolerances[processingMode];
      const tolVal = (currentTolerance / 100) * maxDist;
      const smoothVal = (smoothness / 100) * maxDist;

      const getDistToTarget = (i: number) => Math.sqrt((data[i] - targetRGB.r) ** 2 + (data[i + 1] - targetRGB.g) ** 2 + (data[i + 2] - targetRGB.b) ** 2);
      const getDistToContour = (i: number) => Math.sqrt((data[i] - contourRGB.r) ** 2 + (data[i + 1] - contourRGB.g) ** 2 + (data[i + 2] - contourRGB.b) ** 2);

      const alphaChannel = new Uint8Array(width * height);

      // --- ALGORITHM START ---
      if (processingMode === 'flood-clear') {
        if (floodPoints.length === 0) {
          // Если точек нет, просто рисуем оригинал
          previewCtx.putImageData(imageData, 0, 0);
          setIsProcessing(false);
          return;
        }
        alphaChannel.fill(255);
        const visited = new Uint8Array(width * height);
        floodPoints.forEach(pt => {
          const startX = Math.floor(pt.x); const startY = Math.floor(pt.y);
          if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;
          const stack = [startX, startY];
          while (stack.length) {
            const y = stack.pop()!; const x = stack.pop()!;
            const idx = y * width + x;
            if (visited[idx]) continue;
            visited[idx] = 1;
            const ptr = idx * 4;
            const dist = getDistToContour(ptr);
            if (dist <= tolVal) continue;
            alphaChannel[idx] = 0;
            if (x > 0) stack.push(x - 1, y);
            if (x < width - 1) stack.push(x + 1, y);
            if (y > 0) stack.push(x, y - 1);
            if (y < height - 1) stack.push(x, y + 1);
          }
        });
      } else {
        for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
          const dist = getDistToTarget(i);
          let alpha = 255;
          if (processingMode === 'remove') {
            if (dist <= tolVal) alpha = 0;
            else if (dist <= tolVal + smoothVal && smoothVal > 0) alpha = Math.floor(255 * ((dist - tolVal) / smoothVal));
          } else if (processingMode === 'keep') {
            if (dist > tolVal + smoothVal) alpha = 0;
            else if (dist > tolVal && smoothVal > 0) alpha = Math.floor(255 * (1 - ((dist - tolVal) / smoothVal)));
          }
          alphaChannel[idx] = alpha;
        }
      }

      // Post-processing
      if (edgeChoke > 0) {
        const eroded = new Uint8Array(alphaChannel);
        const r = edgeChoke;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const i = y * width + x;
          if (alphaChannel[i] === 0) continue;
          let hit = false;
          l: for (let ky = -r; ky <= r; ky++) for (let kx = -r; kx <= r; kx++) {
            if (kx === 0 && ky === 0) continue;
            const ny = y + ky, nx = x + kx;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && alphaChannel[ny * width + nx] === 0) { hit = true; break l; }
          }
          if (hit) eroded[i] = 0;
        }
        alphaChannel.set(eroded);
      }
      if (edgeBlur > 0) {
        const blurred = new Uint8Array(alphaChannel);
        const r = Math.max(1, edgeBlur);
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          let sum = 0, c = 0;
          for (let ky = -r; ky <= r; ky++) for (let kx = -r; kx <= r; kx++) {
            const ny = y + ky, nx = x + kx;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) { sum += alphaChannel[ny * width + nx]; c++; }
          }
          blurred[y * width + x] = Math.floor(sum / c);
        }
        alphaChannel.set(blurred);
      }
      if (edgePaint > 0) {
        const r = edgePaint;
        for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
          const i = y * width + x;
          if (alphaChannel[i] === 0) continue;
          let edge = false;
          l2: for (let ky = -r; ky <= r; ky++) for (let kx = -r; kx <= r; kx++) {
            if (kx === 0 && ky === 0) continue;
            const ny = y + ky, nx = x + kx;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height && alphaChannel[ny * width + nx] === 0) { edge = true; break l2; }
          }
          if (edge) { const p = i * 4; data[p] = contourRGB.r; data[p + 1] = contourRGB.g; data[p + 2] = contourRGB.b; }
        }
      }

      // Apply Alpha
      for (let i = 0, idx = 0; i < data.length; i += 4, idx++) data[i + 3] = alphaChannel[idx];

      // --- ALGORITHM END ---

      // Прямая отрисовка результата (без Base64!)
      previewCtx.putImageData(imageData, 0, 0);
      setIsProcessing(false);
    }, 10);
  }, [originalUrl, targetColor, contourColor, tolerances, smoothness, processingMode, floodPoints, edgeChoke, edgeBlur, edgePaint]);

  // Debounce for processing
  useEffect(() => {
    if (!originalUrl) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => { processImage(); }, 50);
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); }
  }, [originalUrl, targetColor, contourColor, tolerances, smoothness, processingMode, floodPoints, edgeChoke, edgeBlur, edgePaint]);

  useEffect(() => { if (manualTrigger > 0 && processingMode === 'flood-clear') processImage(); }, [manualTrigger]);

  // --- HANDLERS ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setOriginalUrl(url);

    // Сброс состояния
    setFloodPoints([]);

    // Загрузка
    loadOriginalToCanvas(url);

    // Авто-детект цвета (упрощенно: берем верхний левый пиксель)
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = 1; c.height = 1;
      const cx = c.getContext('2d');
      if (cx) {
        cx.drawImage(img, 0, 0);
        const p = cx.getImageData(0, 0, 1, 1).data;
        const hex = rgbToHex(p[0], p[1], p[2]);
        setTargetColor(hex);
        setContourColor(invertHex(hex));
      }
    }
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

  const handlePointPointerDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation(); e.preventDefault();
    if (e.button !== 0) return;
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
      if (newCoords) setFloodPoints(prev => { const next = [...prev]; next[draggingPointIndex] = newCoords; return next; });
    }
  };
  const handleGlobalPointerUp = () => { if (draggingPointIndex !== null) setDraggingPointIndex(null); };

  const handleEyedropper = (e: React.MouseEvent) => {
    // Пипетка берет цвет из Source Canvas (оригинал)
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

  return (
    <div className="fixed inset-0 flex w-full h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans">

      {/* --- SIDEBAR --- */}
      <aside className="w-[360px] flex-shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 shadow-xl h-full">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
          <a href="/" className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg> На главную
          </a>
          <h2 className="text-lg font-bold flex items-center gap-2"><span className="text-blue-600">Mono</span>Remover</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase text-zinc-400">Исходник</label>
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 border-zinc-300 dark:bg-zinc-800/50 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-all group">
              <span className="text-xs text-zinc-500">Загрузить изображение</span>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
            </label>
          </div>
          {originalUrl && (
            <div className="space-y-6 animate-fade-in">
              {/* Controls */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-zinc-400">Режим</label>
                <div className="flex flex-col gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                  <div className="grid grid-cols-2 gap-1">
                    <button onClick={() => setProcessingMode('remove')} className={`text-xs font-medium py-2 rounded-md transition-all ${processingMode === 'remove' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Убрать цвет</button>
                    <button onClick={() => setProcessingMode('keep')} className={`text-xs font-medium py-2 rounded-md transition-all ${processingMode === 'keep' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Оставить цвет</button>
                  </div>
                  <button onClick={() => setProcessingMode('flood-clear')} className={`text-xs font-medium py-2 rounded-md transition-all flex items-center justify-center gap-2 ${processingMode === 'flood-clear' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Заливка невидимостью</button>
                </div>
                {processingMode === 'flood-clear' && <div className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-100 dark:border-blue-800 leading-tight">1. Кликните на холст, чтобы поставить точки.<br />2. Точки можно <b>перетаскивать</b>.<br />3. Заливка обновляется <b>автоматически</b>.</div>}
              </div>
              <div className="space-y-2">
                <div className="flex flex-col gap-2">
                  <div className="flex gap-3 items-center">
                    {/* Eyedropper Preview from Source Canvas */}
                    <div className="w-8 h-8 rounded border cursor-crosshair overflow-hidden relative group dark:border-zinc-700 flex-shrink-0 bg-white">
                      {/* We use a tiny separate image for the eyedropper UI button to avoid heavy canvas reads here */}
                      <img src={originalUrl} className="w-full h-full object-cover" onClick={handleEyedropper} alt="picker" />
                    </div>
                    <div className="flex-1 flex items-center gap-2 p-2 border rounded bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700">
                      <input type="color" value={targetColor} onChange={e => setTargetColor(e.target.value)} className="w-6 h-6 bg-transparent border-none cursor-pointer" />
                      <div className="flex flex-col"><span className="font-bold text-[10px] uppercase text-zinc-500">Цель (Фон)</span><span className="font-mono text-xs font-bold uppercase">{targetColor}</span></div>
                    </div>
                  </div>
                  <div className="flex gap-3 items-center">
                    <div className="w-8 h-8 flex-shrink-0" />
                    <div className="flex-1 flex items-center gap-2 p-2 border rounded bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700">
                      <input type="color" value={contourColor} onChange={e => setContourColor(e.target.value)} className="w-6 h-6 bg-transparent border-none cursor-pointer" />
                      <div className="flex flex-col"><span className="font-bold text-[10px] uppercase text-zinc-500">Контур / Окрас</span><span className="font-mono text-xs font-bold uppercase">{contourColor}</span></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-4 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div><div className="flex justify-between text-xs mb-1"><span>Допуск</span><span className="text-blue-500 font-mono">{tolerances[processingMode]}%</span></div><input type="range" min="0" max="100" value={tolerances[processingMode]} onChange={e => setTolerances(p => ({ ...p, [processingMode]: Number(e.target.value) }))} className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-600 accent-blue-600" /></div>
                {processingMode !== 'flood-clear' && (<div><div className="flex justify-between text-xs mb-1"><span>Сглаживание</span><span className="text-blue-500 font-mono">{smoothness}%</span></div><input type="range" min="0" max="50" value={smoothness} onChange={e => setSmoothness(Number(e.target.value))} className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-600 accent-blue-600" /></div>)}
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700/50">
                  <div className="flex justify-between text-xs mb-1"><span className="font-bold text-zinc-500">Удаление ореолов</span></div>
                  <div className="mb-2"><div className="flex justify-between text-[10px] mb-1 text-zinc-500"><span>Сжатие (Choke)</span><span className="text-blue-500 font-mono">{edgeChoke}px</span></div><input type="range" min="0" max="5" step="1" value={edgeChoke} onChange={e => setEdgeChoke(Number(e.target.value))} className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-600 accent-blue-600" /></div>
                  <div className="mb-2"><div className="flex justify-between text-[10px] mb-1 text-zinc-500"><span>Смягчение (Blur)</span><span className="text-blue-500 font-mono">{edgeBlur}px</span></div><input type="range" min="0" max="5" step="1" value={edgeBlur} onChange={e => setEdgeBlur(Number(e.target.value))} className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-600 accent-blue-600" /></div>
                  <div><div className="flex justify-between text-[10px] mb-1 text-zinc-500"><span>Окрашивание (Paint)</span><span className="text-blue-500 font-mono">{edgePaint}px</span></div><input type="range" min="0" max="5" step="1" value={edgePaint} onChange={e => setEdgePaint(Number(e.target.value))} className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-600 accent-blue-600" /></div>
                </div>
              </div>
              {processingMode === 'flood-clear' && (
                <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                  <div className="flex justify-between items-center text-xs font-bold text-blue-800 dark:text-blue-200"><span>Точки: {floodPoints.length}</span></div>
                  <div className="flex gap-2"><button onClick={removeLastPoint} disabled={floodPoints.length === 0} className="flex-1 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 disabled:opacity-50">Отменить</button><button onClick={clearAllPoints} disabled={floodPoints.length === 0} className="flex-1 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded hover:text-red-500 hover:bg-red-50 disabled:opacity-50">Сбросить</button></div>
                  <button onClick={handleRunFloodFill} disabled={floodPoints.length === 0 || isProcessing} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs shadow-sm uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed">{isProcessing ? 'Обработка...' : 'Принудительно обновить'}</button>
                </div>
              )}
              <button onClick={handleDownload} disabled={!originalUrl} className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded font-bold text-sm shadow hover:opacity-90 transition disabled:opacity-50">Скачать</button>
            </div>
          )}
        </div>
      </aside>

      {/* --- MAIN WORKSPACE --- */}
      <main className="flex-1 relative h-full flex flex-col overflow-hidden">
        <div
          className="flex-1 w-full h-full"
          onPointerMove={handleGlobalPointerMove}
          onPointerUp={handleGlobalPointerUp}
        >
          <Canvas
            ref={workspaceRef}
            isLoading={isProcessing}
            contentWidth={imgDimensions.w}
            contentHeight={imgDimensions.h}
          >
            <div
              className="relative origin-top-left"
              style={{
                width: imgDimensions.w,
                height: imgDimensions.h,
                boxShadow: originalUrl ? '0 0 0 50000px rgba(0,0,0,0.8)' : 'none'
              }}
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

              {!originalUrl && (
                <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-lg opacity-50 whitespace-nowrap border-2 border-dashed border-zinc-500/20 rounded-lg">Нет изображения</div>
              )}
            </div>
          </Canvas>
        </div>
      </main>
    </div>
  );
}