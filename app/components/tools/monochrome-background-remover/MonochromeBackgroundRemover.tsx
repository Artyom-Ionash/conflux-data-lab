'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

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

// Функция инверсии цвета
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
  // --- STATE: Данные ---
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [imgDimensions, setImgDimensions] = useState({ w: 0, h: 0 });

  // --- STATE: Настройки ---
  // Теперь у нас два независимых цвета, общих для всех режимов
  const [targetColor, setTargetColor] = useState('#ffffff');   // Цвет фона (для удаления)
  const [contourColor, setContourColor] = useState('#000000'); // Цвет контура (для заливки и окраски)

  const [tolerances, setTolerances] = useState<Record<ProcessingMode, number>>({
    'remove': 20,
    'keep': 20,
    'flood-clear': 20
  });

  const [smoothness, setSmoothness] = useState(10);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('remove');

  // --- STATE: Инструменты постобработки ---
  const [edgeChoke, setEdgeChoke] = useState(0); // Сжатие
  const [edgeBlur, setEdgeBlur] = useState(0);   // Смягчение
  const [edgePaint, setEdgePaint] = useState(0); // Окрашивание

  // Точки заливки
  const [floodPoints, setFloodPoints] = useState<Point[]>([]);
  const [manualTrigger, setManualTrigger] = useState(0);

  // --- STATE: Интерфейс ---
  const [isDarkBackground, setIsDarkBackground] = useState(true);
  const [isAutoContrast, setIsAutoContrast] = useState(false);
  const [autoContrastPeriod, setAutoContrastPeriod] = useState(5);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- STATE: Viewport ---
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Взаимодействие
  const [isPanning, setIsPanning] = useState(false);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);

  // --- REFS ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragDistanceRef = useRef<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const processedUrlRef = useRef(processedUrl);

  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);
  useEffect(() => { processedUrlRef.current = processedUrl; }, [processedUrl]);

  // -------------------------------------------------------------------------
  // УТИЛИТА: КООРДИНАТЫ
  // -------------------------------------------------------------------------
  const getImageCoords = (clientX: number, clientY: number): Point | null => {
    if (!imageRef.current) return null;
    const rect = imageRef.current.getBoundingClientRect();
    const visualX = clientX - rect.left;
    const visualY = clientY - rect.top;

    const ratioX = imageRef.current.naturalWidth / rect.width;
    const ratioY = imageRef.current.naturalHeight / rect.height;

    const x = Math.floor(visualX * ratioX);
    const y = Math.floor(visualY * ratioY);

    if (x >= 0 && x < imageRef.current.naturalWidth && y >= 0 && y < imageRef.current.naturalHeight) {
      return { x, y };
    }
    return null;
  };

  const handleModeChange = (mode: ProcessingMode) => {
    setProcessingMode(mode);
  };

  const handleToleranceChange = (value: number) => {
    setTolerances(prev => ({
      ...prev,
      [processingMode]: value
    }));
  };

  // -------------------------------------------------------------------------
  // Zoom
  // -------------------------------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!processedUrlRef.current) return;

      const zoomSpeed = 0.1;
      const direction = e.deltaY > 0 ? -1 : 1;
      const currentScale = scaleRef.current;
      let newScale = currentScale + direction * zoomSpeed * currentScale;
      newScale = Math.max(0.05, Math.min(newScale, 40));

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const currentOffset = offsetRef.current;
      const scaleRatio = newScale / currentScale;
      const newOffsetX = mouseX - (mouseX - currentOffset.x) * scaleRatio;
      const newOffsetY = mouseY - (mouseY - currentOffset.y) * scaleRatio;

      setScale(newScale);
      setOffset({ x: newOffsetX, y: newOffsetY });
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, []);

  // -------------------------------------------------------------------------
  // Auto Contrast
  // -------------------------------------------------------------------------
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoContrast) {
      const ms = autoContrastPeriod * 1000;
      interval = setInterval(() => {
        setIsDarkBackground(prev => !prev);
      }, ms);
    }
    return () => clearInterval(interval);
  }, [isAutoContrast, autoContrastPeriod]);

  const transitionDurationMs = isAutoContrast ? (autoContrastPeriod * 1000) * 0.9 : 300;

  // -------------------------------------------------------------------------
  // PROCESS IMAGE
  // -------------------------------------------------------------------------
  const processImage = useCallback(() => {
    if (!originalUrl || !imgDimensions.w) return;

    setIsProcessing(true);
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = originalUrl;

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = imgDimensions.w;
      canvas.height = imgDimensions.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);

      setTimeout(() => {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        const width = canvas.width;
        const height = canvas.height;

        // Цвета
        const targetRGB = hexToRgb(targetColor);
        const contourRGB = hexToRgb(contourColor);

        if (!targetRGB || !contourRGB) { setIsProcessing(false); return; }

        const maxDist = 441.67;
        const currentTolerance = tolerances[processingMode];
        const tolVal = (currentTolerance / 100) * maxDist;
        const smoothVal = (smoothness / 100) * maxDist;

        // Функция дистанции до TargetColor (для удаления)
        const getDistToTarget = (i: number) => Math.sqrt(
          (data[i] - targetRGB.r) ** 2 +
          (data[i + 1] - targetRGB.g) ** 2 +
          (data[i + 2] - targetRGB.b) ** 2
        );

        // Функция дистанции до ContourColor (для flood-clear барьера)
        const getDistToContour = (i: number) => Math.sqrt(
          (data[i] - contourRGB.r) ** 2 +
          (data[i + 1] - contourRGB.g) ** 2 +
          (data[i + 2] - contourRGB.b) ** 2
        );

        // Создаем буфер альфа-канала
        const alphaChannel = new Uint8Array(width * height);

        // --- ШАГ 1: Генерация маски (Альфа) ---
        if (processingMode === 'flood-clear') {
          if (floodPoints.length === 0) {
            setProcessedUrl(originalUrl);
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

              const ptr = idx * 4;
              // Для flood-clear используем ContourColor как границу
              const dist = getDistToContour(ptr);

              if (dist <= tolVal) continue; // Останавливаемся на контуре

              alphaChannel[idx] = 0; // Делаем прозрачным

              if (x > 0) stack.push(x - 1, y);
              if (x < width - 1) stack.push(x + 1, y);
              if (y > 0) stack.push(x, y - 1);
              if (y < height - 1) stack.push(x, y + 1);
            }
          });
        } else {
          // Remove / Keep используют TargetColor
          for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
            const dist = getDistToTarget(i);
            let alpha = 255;

            if (processingMode === 'remove') {
              if (dist <= tolVal) {
                alpha = 0;
              } else if (dist <= tolVal + smoothVal && smoothVal > 0) {
                const factor = (dist - tolVal) / smoothVal;
                alpha = Math.floor(255 * factor);
              }
            } else if (processingMode === 'keep') {
              if (dist > tolVal + smoothVal) {
                alpha = 0;
              } else if (dist > tolVal && smoothVal > 0) {
                const factor = (dist - tolVal) / smoothVal;
                alpha = Math.floor(255 * (1 - factor));
              }
            }
            alphaChannel[idx] = alpha;
          }
        }

        // --- ШАГ 2: Сжатие краев (Erode) ---
        if (edgeChoke > 0) {
          const erodedBuffer = new Uint8Array(alphaChannel);
          const radius = edgeChoke;
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = y * width + x;
              if (alphaChannel[idx] === 0) continue;

              let shouldErode = false;
              checkNeighbors:
              for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                  if (kx === 0 && ky === 0) continue;
                  const ny = y + ky;
                  const nx = x + kx;
                  if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIdx = ny * width + nx;
                    if (alphaChannel[nIdx] === 0) {
                      shouldErode = true;
                      break checkNeighbors;
                    }
                  }
                }
              }
              if (shouldErode) erodedBuffer[idx] = 0;
            }
          }
          alphaChannel.set(erodedBuffer);
        }

        // --- ШАГ 3: Размытие краев (Blur) ---
        if (edgeBlur > 0) {
          const blurredBuffer = new Uint8Array(alphaChannel);
          const radius = Math.max(1, edgeBlur);

          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = y * width + x;
              let sum = 0;
              let count = 0;
              for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                  const ny = y + ky;
                  const nx = x + kx;
                  if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIdx = ny * width + nx;
                    sum += alphaChannel[nIdx];
                    count++;
                  }
                }
              }
              blurredBuffer[idx] = Math.floor(sum / count);
            }
          }
          alphaChannel.set(blurredBuffer);
        }

        // --- ШАГ 4: Окрашивание краев (Edge Paint) ---
        // Используем contourRGB для закраски
        if (edgePaint > 0) {
          const radius = edgePaint;
          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = y * width + x;
              // Красим только если это часть объекта (alpha > 0)
              if (alphaChannel[idx] === 0) continue;

              let isEdge = false;
              checkEdge:
              for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                  if (kx === 0 && ky === 0) continue;
                  const ny = y + ky;
                  const nx = x + kx;
                  if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIdx = ny * width + nx;
                    if (alphaChannel[nIdx] === 0) {
                      isEdge = true;
                      break checkEdge;
                    }
                  }
                }
              }

              if (isEdge) {
                const ptr = idx * 4;
                data[ptr] = contourRGB.r;
                data[ptr + 1] = contourRGB.g;
                data[ptr + 2] = contourRGB.b;
                // Делаем пиксель полностью непрозрачным, чтобы перекрыть ореол
                alphaChannel[idx] = 255;
              }
            }
          }
        }

        // --- Финальная сборка ---
        for (let i = 0, idx = 0; i < data.length; i += 4, idx++) {
          data[i + 3] = alphaChannel[idx];
        }

        ctx.putImageData(imageData, 0, 0);
        setProcessedUrl(canvas.toDataURL('image/png'));
        setIsProcessing(false);
      }, 50);
    };
  }, [originalUrl, targetColor, contourColor, tolerances, smoothness, imgDimensions, processingMode, floodPoints, edgeChoke, edgeBlur, edgePaint]);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    debounceTimerRef.current = setTimeout(() => {
      if (originalUrl) processImage();
    }, 100);

    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); }
  }, [originalUrl, targetColor, contourColor, tolerances, smoothness, processingMode, floodPoints, edgeChoke, edgeBlur, edgePaint]);

  useEffect(() => {
    if (manualTrigger > 0 && processingMode === 'flood-clear') {
      processImage();
    }
  }, [manualTrigger]);

  // -------------------------------------------------------------------------
  // HANDLERS
  // -------------------------------------------------------------------------
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;

    img.onload = () => {
      // 1. Определяем цвет пикселя (0,0)
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const p = ctx.getImageData(0, 0, 1, 1).data;
        const detectedColor = rgbToHex(p[0], p[1], p[2]);

        // 2. Устанавливаем TargetColor (фон)
        setTargetColor(detectedColor);
        // 3. Устанавливаем ContourColor (инверсия)
        setContourColor(invertHex(detectedColor));
      }

      setOriginalUrl(url);
      setProcessedUrl(url);
      setImgDimensions({ w: img.width, h: img.height });
      setFloodPoints([]);

      if (containerRef.current) {
        const contW = containerRef.current.clientWidth;
        const contH = containerRef.current.clientHeight;
        const scaleFactor = Math.min(1, Math.min((contW - 40) / img.width, (contH - 40) / img.height));
        const initialScale = scaleFactor > 0 ? scaleFactor : 1;
        setScale(initialScale);
        setOffset({
          x: (contW - img.width * initialScale) / 2,
          y: (contH - img.height * initialScale) / 2
        });
      }
    };
  };

  const handlePointPointerDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0) return;

    setDraggingPointIndex(index);
    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }
  };

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (!originalUrl) return;
    if (e.button !== 0) return;

    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    dragDistanceRef.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggingPointIndex !== null) {
      const newCoords = getImageCoords(e.clientX, e.clientY);
      if (newCoords) {
        setFloodPoints(prev => {
          const next = [...prev];
          next[draggingPointIndex] = newCoords;
          return next;
        });
      }
      return;
    }

    if (isPanning) {
      const deltaX = Math.abs(e.clientX - (panStartRef.current.x + offset.x));
      const deltaY = Math.abs(e.clientY - (panStartRef.current.y + offset.y));
      dragDistanceRef.current += deltaX + deltaY;

      const newX = e.clientX - panStartRef.current.x;
      const newY = e.clientY - panStartRef.current.y;
      setOffset({ x: newX, y: newY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.button !== 0) return;

    if (draggingPointIndex !== null) {
      setDraggingPointIndex(null);
      return;
    }

    if (isPanning) {
      setIsPanning(false);
      if (dragDistanceRef.current < 5 && processingMode === 'flood-clear') {
        const newCoords = getImageCoords(e.clientX, e.clientY);
        if (newCoords) {
          setFloodPoints(prev => [...prev, newCoords]);
        }
      }
    }
  };

  const handleRunFloodFill = () => setManualTrigger(prev => prev + 1);

  const handleDownload = () => {
    if (!processedUrl) return;
    const a = document.createElement('a');
    a.href = processedUrl;
    a.download = 'result.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleResetView = () => {
    if (containerRef.current && imgDimensions.w > 0) {
      const contW = containerRef.current.clientWidth;
      const contH = containerRef.current.clientHeight;
      const scaleFactor = Math.min(1, Math.min((contW - 40) / imgDimensions.w, (contH - 40) / imgDimensions.h));
      const finalScale = scaleFactor > 0 ? scaleFactor : 1;
      setScale(finalScale);
      setOffset({
        x: (contW - imgDimensions.w * finalScale) / 2,
        y: (contH - imgDimensions.h * finalScale) / 2
      });
    } else {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
  };

  const handleEyedropper = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!originalUrl) return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * img.naturalWidth;
    const y = (e.clientY - rect.top) / rect.height * img.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const i = new Image();
    i.src = originalUrl;
    i.onload = () => {
      ctx.drawImage(i, -Math.floor(x), -Math.floor(y));
      const p = ctx.getImageData(0, 0, 1, 1).data;
      // Пипетка меняет целевой цвет (фон)
      setTargetColor(rgbToHex(p[0], p[1], p[2]));
    }
  };

  const removeLastPoint = () => setFloodPoints(prev => prev.slice(0, -1));
  const clearAllPoints = () => setFloodPoints([]);

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans">
      <canvas ref={canvasRef} className="hidden" />

      {/* ================= ЛЕВАЯ ПАНЕЛЬ ================= */}
      <aside className="w-[360px] flex-shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 shadow-xl">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="text-blue-600">Mono</span>Remover
          </h2>
          <p className="text-xs text-zinc-500 mt-1">Инструменты обработки фона</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase text-zinc-400">Исходник</label>
            <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 border-zinc-300 dark:bg-zinc-800/50 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-all group">
              <div className="flex flex-col items-center justify-center">
                <p className="text-xs text-zinc-500">Загрузить изображение</p>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
            </label>
          </div>

          {originalUrl && (
            <div className="space-y-6 animate-fade-in">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-zinc-400">Режим</label>
                <div className="flex flex-col gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
                  <div className="grid grid-cols-2 gap-1">
                    <button onClick={() => handleModeChange('remove')} className={`text-xs font-medium py-2 rounded-md transition-all ${processingMode === 'remove' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Убрать цвет</button>
                    <button onClick={() => handleModeChange('keep')} className={`text-xs font-medium py-2 rounded-md transition-all ${processingMode === 'keep' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>Оставить цвет</button>
                  </div>
                  <button onClick={() => handleModeChange('flood-clear')} className={`text-xs font-medium py-2 rounded-md transition-all flex items-center justify-center gap-2 ${processingMode === 'flood-clear' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-300 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}>
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

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-zinc-400">Цвета</label>

                {/* Выбор цвета фона (Целевой) */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-3 items-center">
                    <div className="w-8 h-8 rounded border cursor-crosshair overflow-hidden relative group dark:border-zinc-700 flex-shrink-0">
                      <img src={originalUrl} className="w-full h-full object-cover" onClick={handleEyedropper} alt="picker" />
                    </div>
                    <div className="flex-1 flex items-center gap-2 p-2 border rounded bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700">
                      <input
                        type="color"
                        value={targetColor}
                        onChange={e => setTargetColor(e.target.value)}
                        className="w-6 h-6 bg-transparent border-none cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-[10px] uppercase text-zinc-500">Цель (Фон)</span>
                        <span className="font-mono text-xs font-bold uppercase">{targetColor}</span>
                      </div>
                    </div>
                  </div>

                  {/* Выбор цвета контура */}
                  <div className="flex gap-3 items-center">
                    <div className="w-8 h-8 flex-shrink-0" /> {/* Spacer */}
                    <div className="flex-1 flex items-center gap-2 p-2 border rounded bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700">
                      <input
                        type="color"
                        value={contourColor}
                        onChange={e => setContourColor(e.target.value)}
                        className="w-6 h-6 bg-transparent border-none cursor-pointer"
                      />
                      <div className="flex flex-col">
                        <span className="font-bold text-[10px] uppercase text-zinc-500">Контур / Окраска</span>
                        <span className="font-mono text-xs font-bold uppercase">{contourColor}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Допуск</span>
                    <span className="text-blue-500 font-mono">{tolerances[processingMode]}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={tolerances[processingMode]}
                    onChange={e => handleToleranceChange(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-600 accent-blue-600"
                  />
                </div>
                {processingMode !== 'flood-clear' && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>Сглаживание</span>
                      <span className="text-blue-500 font-mono">{smoothness}%</span>
                    </div>
                    <input type="range" min="0" max="50" value={smoothness} onChange={e => setSmoothness(Number(e.target.value))} className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-600 accent-blue-600" />
                  </div>
                )}

                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700/50">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-bold text-zinc-500">Удаление ореолов</span>
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] mb-1 text-zinc-500">
                      <span>Сжатие краев (Choke)</span>
                      <span className="text-blue-500 font-mono">{edgeChoke}px</span>
                    </div>
                    <input type="range" min="0" max="5" step="1" value={edgeChoke} onChange={e => setEdgeChoke(Number(e.target.value))} className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-600 accent-blue-600" />
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between text-[10px] mb-1 text-zinc-500">
                      <span>Смягчение (Blur)</span>
                      <span className="text-blue-500 font-mono">{edgeBlur}px</span>
                    </div>
                    <input type="range" min="0" max="5" step="1" value={edgeBlur} onChange={e => setEdgeBlur(Number(e.target.value))} className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-600 accent-blue-600" />
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] mb-1 text-zinc-500">
                      <span>Окрашивание (Paint)</span>
                      <span className="text-blue-500 font-mono">{edgePaint}px</span>
                    </div>
                    <input type="range" min="0" max="5" step="1" value={edgePaint} onChange={e => setEdgePaint(Number(e.target.value))} className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-600 accent-blue-600" />
                  </div>
                </div>
              </div>

              {processingMode === 'flood-clear' && (
                <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                  <div className="flex justify-between items-center text-xs font-bold text-blue-800 dark:text-blue-200"><span>Точки: {floodPoints.length}</span></div>
                  <div className="flex gap-2">
                    <button onClick={removeLastPoint} disabled={floodPoints.length === 0} className="flex-1 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 disabled:opacity-50">Отменить</button>
                    <button onClick={clearAllPoints} disabled={floodPoints.length === 0} className="flex-1 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded hover:text-red-500 hover:bg-red-50 disabled:opacity-50">Сбросить</button>
                  </div>
                  <button onClick={handleRunFloodFill} disabled={floodPoints.length === 0 || isProcessing} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs shadow-sm uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed">{isProcessing ? 'Обработка...' : 'Принудительно обновить'}</button>
                </div>
              )}
              <button onClick={handleDownload} disabled={!processedUrl} className="w-full py-3 bg-zinc-900 dark:bg-white text-white dark:text-black rounded font-bold text-sm shadow hover:opacity-90 transition disabled:opacity-50">Скачать</button>
            </div>
          )}
        </div>
      </aside>

      {/* ================= ПРАВАЯ ПАНЕЛЬ ================= */}
      <main className="flex-1 relative flex flex-col bg-zinc-100 dark:bg-[#0a0a0a] overflow-hidden">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur px-3 py-2 rounded-full shadow-lg border border-zinc-200 dark:border-zinc-700">
          <button onClick={() => setIsAutoContrast(!isAutoContrast)} className={`p-2 rounded-full ${isAutoContrast ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-zinc-100 text-zinc-500'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>

          {/* Индикатор секунд */}
          {isAutoContrast && (
            <div className="flex items-center gap-2 mx-1">
              <input type="range" min="1" max="10" step="1" value={autoContrastPeriod} onChange={e => setAutoContrastPeriod(Number(e.target.value))} className="w-16 h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-blue-600" />
              <span className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-300 w-5">{autoContrastPeriod}s</span>
            </div>
          )}

          <button onClick={() => { setIsAutoContrast(false); setIsDarkBackground(!isDarkBackground) }} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500">{isDarkBackground ? "🌙" : "☀️"}</button>
          <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1" />
          <button onClick={handleResetView} className="text-xs font-mono px-2 text-zinc-500">{(scale * 100).toFixed(0)}%</button>
        </div>

        <div
          ref={containerRef}
          className={`flex-1 relative overflow-hidden select-none transition-colors ease-in-out ${isDarkBackground ? 'bg-[#111]' : 'bg-[#e5e5e5]'}`}
          style={{
            transitionDuration: `${transitionDurationMs}ms`,
            cursor: draggingPointIndex !== null ? 'grabbing' : (isPanning ? 'grabbing' : (processingMode === 'flood-clear' ? 'crosshair' : 'grab'))
          }}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        >
          <div className={`absolute inset-0 pointer-events-none transition-opacity ease-in-out ${isDarkBackground ? 'opacity-10' : 'opacity-30'}`} style={{ transitionDuration: `${transitionDurationMs}ms`, backgroundImage: 'linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%)', backgroundSize: '20px 20px' }} />

          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center will-change-transform" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
            {processedUrl ? (
              <div className="relative shadow-2xl">
                <img
                  ref={imageRef}
                  src={processedUrl}
                  alt="Work"
                  draggable={false}
                  className="max-w-none block"
                  style={{ imageRendering: 'pixelated' }}
                />

                {processingMode === 'flood-clear' && floodPoints.map((pt, i) => (
                  <div
                    key={i}
                    onPointerDown={(e) => handlePointPointerDown(e, i)}
                    className={`absolute z-20 cursor-grab active:cursor-grabbing hover:brightness-125 ${draggingPointIndex === i ? 'brightness-150' : ''}`}
                    style={{
                      left: pt.x,
                      top: pt.y,
                      width: '10px',
                      height: '10px',
                      transform: `translate(-50%, -50%) scale(${1 / scale})`,
                      willChange: 'transform'
                    }}
                  >
                    <div className="w-full h-full bg-red-500 border border-white rounded-full shadow-[0_0_2px_rgba(0,0,0,0.8)]" />
                  </div>
                ))}

                {isProcessing && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[3px] flex flex-col items-center justify-center z-50 text-white rounded-sm">
                    <svg className="animate-spin h-10 w-10 mb-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xs font-bold uppercase tracking-widest">Обработка...</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-zinc-400 text-sm opacity-50 pointer-events-none">Нет изображения</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}