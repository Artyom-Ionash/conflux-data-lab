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
  const [targetColor, setTargetColor] = useState('#ffffff');
  const [tolerance, setTolerance] = useState(20);
  const [smoothness, setSmoothness] = useState(10);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('remove');

  // Точки заливки
  const [floodPoints, setFloodPoints] = useState<Point[]>([]);
  const [manualTrigger, setManualTrigger] = useState(0);

  // --- STATE: Интерфейс ---
  const [isDarkBackground, setIsDarkBackground] = useState(true);
  const [isAutoContrast, setIsAutoContrast] = useState(true);
  const [contrastFreq, setContrastFreq] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- STATE: Viewport ---
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Взаимодействие
  const [isPanning, setIsPanning] = useState(false);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);

  // --- REFS ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null); // Ссылка на саму картинку
  const containerRef = useRef<HTMLDivElement>(null);

  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragDistanceRef = useRef<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Ссылки для актуального доступа в обработчиках событий
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const processedUrlRef = useRef(processedUrl);

  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);
  useEffect(() => { processedUrlRef.current = processedUrl; }, [processedUrl]);

  // -------------------------------------------------------------------------
  // УТИЛИТА: ПОЛУЧЕНИЕ КООРДИНАТ КЛИКА ОТНОСИТЕЛЬНО КАРТИНКИ
  // Это "Серебряная пуля" для точных координат при любом Zoom/Pan
  // -------------------------------------------------------------------------
  const getImageCoords = (clientX: number, clientY: number): Point | null => {
    if (!imageRef.current) return null;

    // Получаем реальное положение картинки на экране
    const rect = imageRef.current.getBoundingClientRect();

    // Координаты внутри элемента img (в экранных пикселях)
    const visualX = clientX - rect.left;
    const visualY = clientY - rect.top;

    // Пропорция: (внутренний размер / визуальный размер)
    // Если картинка зумирована, rect.width будет большим, а naturalWidth константой.
    const ratioX = imageRef.current.naturalWidth / rect.width;
    const ratioY = imageRef.current.naturalHeight / rect.height;

    const x = Math.floor(visualX * ratioX);
    const y = Math.floor(visualY * ratioY);

    // Проверка границ
    if (x >= 0 && x < imageRef.current.naturalWidth && y >= 0 && y < imageRef.current.naturalHeight) {
      return { x, y };
    }
    return null;
  };

  // -------------------------------------------------------------------------
  // Смена режима
  // -------------------------------------------------------------------------
  const handleModeChange = (mode: ProcessingMode) => {
    setProcessingMode(mode);
    if (mode !== 'flood-clear') setFloodPoints([]);

    if (mode === 'flood-clear') {
      setTargetColor('#000000');
    } else if (targetColor === '#000000') {
      setTargetColor('#ffffff');
    }
  };

  // -------------------------------------------------------------------------
  // Zoom (Колесико)
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
      newScale = Math.max(0.05, Math.min(newScale, 20));

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Логика зума к курсору
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
      const ms = 1000 / contrastFreq;
      interval = setInterval(() => {
        setIsDarkBackground(prev => !prev);
      }, ms);
    }
    return () => clearInterval(interval);
  }, [isAutoContrast, contrastFreq]);

  const transitionDurationMs = Math.min(2000, (1000 / contrastFreq) * 0.9);

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

        const targetRGB = hexToRgb(targetColor);
        if (!targetRGB) { setIsProcessing(false); return; }

        const maxDist = 441.67;
        const tolVal = (tolerance / 100) * maxDist;
        const smoothVal = (smoothness / 100) * maxDist;

        const getDist = (i: number) => Math.sqrt(
          (data[i] - targetRGB.r) ** 2 +
          (data[i + 1] - targetRGB.g) ** 2 +
          (data[i + 2] - targetRGB.b) ** 2
        );

        if (processingMode === 'flood-clear') {
          if (floodPoints.length === 0) {
            setProcessedUrl(originalUrl);
            setIsProcessing(false);
            return;
          }

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
              const dist = getDist(ptr);

              // Стена (контур)
              if (dist <= tolVal) continue;

              // Заливка
              data[ptr + 3] = 0;

              if (x > 0) stack.push(x - 1, y);
              if (x < width - 1) stack.push(x + 1, y);
              if (y > 0) stack.push(x, y - 1);
              if (y < height - 1) stack.push(x, y + 1);
            }
          });

        } else {
          for (let i = 0; i < data.length; i += 4) {
            const dist = getDist(i);
            if (processingMode === 'remove') {
              if (dist <= tolVal) {
                data[i + 3] = 0;
              } else if (dist <= tolVal + smoothVal && smoothVal > 0) {
                const factor = (dist - tolVal) / smoothVal;
                data[i + 3] = Math.floor(data[i + 3] * factor);
              }
            } else if (processingMode === 'keep') {
              if (dist > tolVal + smoothVal) {
                data[i + 3] = 0;
              } else if (dist > tolVal && smoothVal > 0) {
                const factor = (dist - tolVal) / smoothVal;
                data[i + 3] = Math.floor(data[i + 3] * (1 - factor));
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        setProcessedUrl(canvas.toDataURL('image/png'));
        setIsProcessing(false);
      }, 50);
    };
  }, [originalUrl, targetColor, tolerance, smoothness, imgDimensions, processingMode, floodPoints]);

  // --- TRIGGERS ---
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (processingMode !== 'flood-clear') {
      debounceTimerRef.current = setTimeout(() => {
        if (originalUrl) processImage();
      }, 100);
    }
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); }
  }, [originalUrl, targetColor, tolerance, smoothness, processingMode]);

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

  // === ИСПРАВЛЕННАЯ ЛОГИКА ВЗАИМОДЕЙСТВИЯ ===

  // 1. Клик по самой точке (Начало перетаскивания точки)
  const handlePointPointerDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation(); // Не запускаем Pan холста
    e.preventDefault();

    setDraggingPointIndex(index);

    // ВАЖНО: Захватываем курсор на КОНТЕЙНЕРЕ, чтобы отслеживать движение даже если курсор уйдет с точки
    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }
  };

  // 2. Нажатие на холст (Начало Pan)
  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (!originalUrl) return;

    // Если нажали на точку, этот обработчик не сработает из-за stopPropagation

    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }

    setIsPanning(true);
    panStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    dragDistanceRef.current = 0;
  };

  // 3. Движение мыши (общее для Pan и Drag Point)
  const handlePointerMove = (e: React.PointerEvent) => {
    // А. Перетаскивание точки
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

    // Б. Панорамирование холста
    if (isPanning) {
      const deltaX = Math.abs(e.clientX - (panStartRef.current.x + offset.x));
      const deltaY = Math.abs(e.clientY - (panStartRef.current.y + offset.y));
      dragDistanceRef.current += deltaX + deltaY;

      const newX = e.clientX - panStartRef.current.x;
      const newY = e.clientY - panStartRef.current.y;
      setOffset({ x: newX, y: newY });
    }
  };

  // 4. Отпускание мыши
  const handlePointerUp = (e: React.PointerEvent) => {
    // Сброс перетаскивания точки
    if (draggingPointIndex !== null) {
      setDraggingPointIndex(null);
      return;
    }

    // Завершение панорамирования и проверка на клик
    if (isPanning) {
      setIsPanning(false);

      // Если это был КЛИК (а не перетаскивание) и режим ЗАЛИВКИ
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
    // Логика пипетки для превью слева
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
      setTargetColor(rgbToHex(p[0], p[1], p[2]));
    }
  };

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
          {/* Загрузка */}
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
              {/* Режимы */}
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
                    3. Нажмите "Выполнить заливку".
                  </div>
                )}
              </div>

              {/* Цвет */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-zinc-400">{processingMode === 'flood-clear' ? 'Цвет контура' : 'Целевой цвет'}</label>
                <div className="flex gap-3 items-center">
                  <div className="w-12 h-12 rounded border cursor-crosshair overflow-hidden relative group dark:border-zinc-700">
                    <img src={originalUrl} className="w-full h-full object-cover" onClick={handleEyedropper} alt="picker" />
                  </div>
                  <div className="flex-1 flex items-center gap-2 p-2 border rounded bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700">
                    <input type="color" value={targetColor} onChange={e => setTargetColor(e.target.value)} className="w-8 h-8 bg-transparent border-none cursor-pointer" />
                    <span className="font-mono text-xs font-bold uppercase">{targetColor}</span>
                  </div>
                </div>
              </div>

              {/* Настройки */}
              <div className="space-y-4 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Допуск</span>
                    <span className="text-blue-500 font-mono">{tolerance}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={tolerance} onChange={e => setTolerance(Number(e.target.value))} className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-600 accent-blue-600" />
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
              </div>

              {/* Кнопки заливки */}
              {processingMode === 'flood-clear' && (
                <div className="space-y-3 p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30">
                  <div className="flex justify-between items-center text-xs font-bold text-blue-800 dark:text-blue-200"><span>Точки: {floodPoints.length}</span></div>
                  <div className="flex gap-2">
                    <button onClick={() => setFloodPoints(p => p.slice(0, -1))} disabled={floodPoints.length === 0} className="flex-1 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded hover:bg-zinc-50 disabled:opacity-50">Отменить</button>
                    <button onClick={() => setFloodPoints([])} disabled={floodPoints.length === 0} className="flex-1 py-2 text-xs bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded hover:text-red-500 hover:bg-red-50 disabled:opacity-50">Сбросить</button>
                  </div>
                  <button onClick={handleRunFloodFill} disabled={floodPoints.length === 0 || isProcessing} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs shadow-sm uppercase tracking-wide disabled:opacity-50 disabled:cursor-not-allowed">{isProcessing ? 'Обработка...' : 'Выполнить заливку'}</button>
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
          {isAutoContrast && <input type="range" min="0.2" max="5" step="0.1" value={contrastFreq} onChange={e => setContrastFreq(Number(e.target.value))} className="w-16 h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-blue-600 mx-2" />}
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
        >
          <div className={`absolute inset-0 pointer-events-none transition-opacity ease-in-out ${isDarkBackground ? 'opacity-10' : 'opacity-30'}`} style={{ transitionDuration: `${transitionDurationMs}ms`, backgroundImage: 'linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%)', backgroundSize: '20px 20px' }} />

          <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center will-change-transform" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
            {processedUrl ? (
              <div className="relative shadow-2xl">
                {/* Картинка (Ref добавлен сюда!) */}
                <img
                  ref={imageRef}
                  src={processedUrl}
                  alt="Work"
                  draggable={false}
                  className="max-w-none block"
                />

                {/* Точки заливки: теперь позиционируются абсолютно относительно контейнера картинки */}
                {processingMode === 'flood-clear' && floodPoints.map((pt, i) => (
                  <div
                    key={i}
                    onPointerDown={(e) => handlePointPointerDown(e, i)}
                    // ВАЖНО: Эти координаты (pt.x, pt.y) - это пиксели внутри картинки.
                    // Так как этот div находится ВНУТРИ трансформируемого контейнера вместе с картинкой,
                    // CSS left/top будут работать корректно, совпадая с пикселями картинки, 
                    // если картинка отображается в натуральный размер (или масштабируется CSS-ом родителя).
                    // Здесь картинка отображается в натуральный размер (max-w-none), а масштаб задает родитель (scale).
                    // Значит, pt.x = left.
                    className={`absolute w-6 h-6 flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing z-20 hover:scale-110 transition-transform ${draggingPointIndex === i ? 'scale-125' : ''}`}
                    style={{ left: pt.x, top: pt.y }}
                  >
                    <div className="w-3 h-3 bg-red-500 border-2 border-white rounded-full shadow-md relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-[1px] bg-red-500/30 pointer-events-none" />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-6 bg-red-500/30 pointer-events-none" />
                    </div>
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