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
  // --- STATE: Данные изображения ---
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [imgDimensions, setImgDimensions] = useState({ w: 0, h: 0 });

  // --- STATE: Настройки обработки ---
  const [targetColor, setTargetColor] = useState('#ffffff');
  const [tolerance, setTolerance] = useState(20);
  const [smoothness, setSmoothness] = useState(10);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('remove');

  // Состояние для хранения точек клика в режиме заливки
  const [floodPoints, setFloodPoints] = useState<Point[]>([]);

  // --- STATE: Интерфейс ---
  const [isDarkBackground, setIsDarkBackground] = useState(true);
  const [isAutoContrast, setIsAutoContrast] = useState(true);
  const [contrastFreq, setContrastFreq] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- STATE: Viewport ---
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // --- REFS ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  // Для различения клика и драга
  const dragDistanceRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  const processedUrlRef = useRef(processedUrl);

  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { offsetRef.current = offset; }, [offset]);
  useEffect(() => { processedUrlRef.current = processedUrl; }, [processedUrl]);

  // -------------------------------------------------------------------------
  // Смена режима и дефолтные цвета
  // -------------------------------------------------------------------------
  const handleModeChange = (mode: ProcessingMode) => {
    setProcessingMode(mode);
    // Если переключились на режим заливки по контуру - ставим черный по умолчанию
    if (mode === 'flood-clear') {
      setTargetColor('#000000');
    } else if (targetColor === '#000000') {
      // Если ушли с заливки и цвет был черный, можно вернуть белый для удобства (опционально)
      setTargetColor('#ffffff');
    }
  };

  // -------------------------------------------------------------------------
  // Zoom Effect
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
  // Auto Contrast Effect
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
  // IMAGE PROCESSING LOGIC
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
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      const targetRGB = hexToRgb(targetColor);
      if (!targetRGB) { setIsProcessing(false); return; }

      const maxDist = 441.67;
      const tolVal = (tolerance / 100) * maxDist;
      const smoothVal = (smoothness / 100) * maxDist;

      // Вспомогательная функция расстояния цвета
      const getColorDist = (r: number, g: number, b: number) => {
        return Math.sqrt(
          (r - targetRGB.r) ** 2 +
          (g - targetRGB.g) ** 2 +
          (b - targetRGB.b) ** 2
        );
      };

      if (processingMode === 'flood-clear') {
        // --- РЕЖИМ 3: ЗАЛИВКА НЕВИДИМОСТЬЮ ПО КОНТУРУ (FLOOD FILL) ---

        // Для заливки используем стек.
        // Мы должны запустить заливку для КАЖДОЙ точки, которую поставил пользователь.

        // Используем массив посещенных пикселей (Uint8Array), чтобы не зацикливаться,
        // но сбрасываем его для каждой новой точки старта (или объединяем, если области пересекаются).
        // В данном случае достаточно одного массива visited на весь проход, так как если пиксель уже прозрачный, трогать его нет смысла.
        const visited = new Uint8Array(width * height);

        floodPoints.forEach(pt => {
          const startX = Math.floor(pt.x);
          const startY = Math.floor(pt.y);

          // Проверка границ
          if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

          const stack = [startX, startY];

          while (stack.length > 0) {
            const y = stack.pop()!;
            const x = stack.pop()!;
            const idx = y * width + x;

            if (visited[idx]) continue;
            visited[idx] = 1;

            const ptr = idx * 4;

            // 1. Проверяем, является ли текущий пиксель "Контуром"
            const r = data[ptr];
            const g = data[ptr + 1];
            const b = data[ptr + 2];
            const dist = getColorDist(r, g, b);

            // Если цвет совпадает с цветом контура (расстояние <= tolerance), мы останавливаемся.
            // Это "Стена".
            if (dist <= tolVal) {
              continue;
            }

            // 2. Это не стена -> Делаем прозрачным
            data[ptr + 3] = 0;

            // 3. Добавляем соседей
            if (x > 0) stack.push(x - 1, y);
            if (x < width - 1) stack.push(x + 1, y);
            if (y > 0) stack.push(x, y - 1);
            if (y < height - 1) stack.push(x, y + 1);
          }
        });

      } else {
        // --- ОБЫЧНЫЕ РЕЖИМЫ (Глобальная обработка) ---
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const dist = getColorDist(r, g, b);

          if (processingMode === 'remove') {
            // Удалить похожие
            if (dist <= tolVal) {
              data[i + 3] = 0;
            } else if (dist <= tolVal + smoothVal && smoothVal > 0) {
              const factor = (dist - tolVal) / smoothVal;
              data[i + 3] = Math.floor(data[i + 3] * factor);
            }
          } else if (processingMode === 'keep') {
            // Оставить похожие (удалить непохожие)
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
    };
  }, [originalUrl, targetColor, tolerance, smoothness, imgDimensions, processingMode, floodPoints]);

  // Debounce processing
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (originalUrl) processImage();
    }, 100);
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); }
  }, [processImage]);

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
      setImgDimensions({ w: img.width, h: img.height });
      // Reset points on new image
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

      // Auto-pick color logic (optional, keeping it minimal for flood mode)
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 1;
      tempCanvas.height = 1;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
        const p = ctx.getImageData(0, 0, 1, 1).data;
        // Only auto-set if NOT in flood mode (flood defaults to black)
        if (processingMode !== 'flood-clear') {
          setTargetColor(rgbToHex(p[0], p[1], p[2]));
        }
      }
    };
  };

  // --- POINTER HANDLERS (Pan vs Click) ---

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!processedUrl) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    // Запоминаем позицию клика для проверки на "драг"
    dragDistanceRef.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;

    // Считаем дельту движения
    const deltaX = Math.abs(e.clientX - (dragStartRef.current.x + offset.x));
    const deltaY = Math.abs(e.clientY - (dragStartRef.current.y + offset.y));
    dragDistanceRef.current += deltaX + deltaY;

    setOffset({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);

    // Если это был клик (двигали мышь меньше чем на 5 пикселей) и мы в режиме заливки
    if (dragDistanceRef.current < 5 && processingMode === 'flood-clear' && originalUrl) {
      // Вычисляем координаты внутри изображения
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Преобразуем координаты экрана в координаты картинки
      // Formula: imageX = (screenX - offsetX) / scale
      const imgX = (clickX - offset.x) / scale;
      const imgY = (clickY - offset.y) / scale;

      // Проверяем, попали ли в картинку
      if (imgX >= 0 && imgX < imgDimensions.w && imgY >= 0 && imgY < imgDimensions.h) {
        setFloodPoints(prev => [...prev, { x: imgX, y: imgY }]);
      }
    }
  };

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
      setTargetColor(rgbToHex(p[0], p[1], p[2]));
    }
  };

  const removeLastPoint = () => {
    setFloodPoints(prev => prev.slice(0, -1));
  };

  const clearAllPoints = () => {
    setFloodPoints([]);
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
            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 border-zinc-300 dark:bg-zinc-800/50 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-all group">
              <div className="flex flex-col items-center justify-center">
                <svg className="w-6 h-6 mb-2 text-zinc-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                <p className="text-xs text-zinc-500">Нажмите для загрузки</p>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
            </label>
          </div>

          {originalUrl && (
            <div className="space-y-6 animate-fade-in">

              {/* Выбор режима */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-zinc-400">Режим обработки</label>
                <div className="flex flex-col gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      onClick={() => handleModeChange('remove')}
                      className={`text-xs font-medium py-2 rounded-md transition-all ${processingMode === 'remove'
                          ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-300 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }`}
                    >
                      Убрать цвет
                    </button>
                    <button
                      onClick={() => handleModeChange('keep')}
                      className={`text-xs font-medium py-2 rounded-md transition-all ${processingMode === 'keep'
                          ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-300 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                        }`}
                    >
                      Оставить цвет
                    </button>
                  </div>
                  <button
                    onClick={() => handleModeChange('flood-clear')}
                    className={`text-xs font-medium py-2 rounded-md transition-all flex items-center justify-center gap-2 ${processingMode === 'flood-clear'
                        ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-300 shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                      }`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                    Заливка невидимостью (по контуру)
                  </button>
                </div>

                {processingMode === 'flood-clear' && (
                  <div className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-100 dark:border-blue-800">
                    Нажмите на область изображения, которую нужно сделать прозрачной. Заливка остановится на цвете контура.
                  </div>
                )}
              </div>

              <hr className="border-zinc-100 dark:border-zinc-800" />

              {/* Целевой цвет */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-zinc-400">
                  {processingMode === 'flood-clear' ? 'Цвет контура (граница)' : (processingMode === 'remove' ? 'Удаляемый цвет' : 'Сохраняемый цвет')}
                </label>
                <div className="flex gap-3 items-start">
                  <div className="relative group w-16 h-16 border rounded-md overflow-hidden cursor-crosshair shrink-0 dark:border-zinc-700 bg-checkerboard shadow-sm">
                    <img src={originalUrl} className="w-full h-full object-cover" alt="mini" onClick={handleEyedropper} />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 text-white drop-shadow-md">
                        Пипетка
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 p-2 border rounded-md bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700">
                      <input
                        type="color"
                        value={targetColor}
                        onChange={(e) => setTargetColor(e.target.value)}
                        className="w-8 h-8 cursor-pointer border-none bg-transparent p-0 rounded"
                      />
                      <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-400 uppercase">HEX</span>
                        <span className="text-sm font-mono font-bold uppercase">{targetColor}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Управление точками заливки */}
              {processingMode === 'flood-clear' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase text-zinc-400">Точки старта заливки: {floodPoints.length}</label>
                  <div className="flex gap-2">
                    <button
                      onClick={removeLastPoint}
                      disabled={floodPoints.length === 0}
                      className="flex-1 px-3 py-2 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 disabled:opacity-50"
                    >
                      Отменить точку
                    </button>
                    <button
                      onClick={clearAllPoints}
                      disabled={floodPoints.length === 0}
                      className="flex-1 px-3 py-2 text-xs font-medium bg-red-50 hover:bg-red-100 text-red-600 rounded dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 disabled:opacity-50"
                    >
                      Сбросить все
                    </button>
                  </div>
                </div>
              )}

              {/* Слайдеры (скрываем мягкость для заливки, там она сложнее реализуется, но оставим допуск) */}
              <div className="space-y-5 bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg border border-zinc-100 dark:border-zinc-800">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">Допуск (Tolerance)</span>
                    <span className="text-blue-500 font-mono">{tolerance}%</span>
                  </div>
                  <input
                    type="range" min="0" max="100" step="1"
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-600 accent-blue-600"
                  />
                </div>

                {processingMode !== 'flood-clear' && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">Мягкость краев</span>
                      <span className="text-blue-500 font-mono">{smoothness}%</span>
                    </div>
                    <input
                      type="range" min="0" max="50" step="1"
                      value={smoothness}
                      onChange={(e) => setSmoothness(Number(e.target.value))}
                      className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-600 accent-blue-600"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={handleDownload}
                disabled={!processedUrl}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4-4m0 0l-4 4m4-4v12"></path></svg>
                Скачать результат
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ================= ПРАВАЯ ПАНЕЛЬ (ХОЛСТ) ================= */}
      <main className="flex-1 relative flex flex-col bg-zinc-100 dark:bg-[#0a0a0a] overflow-hidden">

        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm px-3 py-2 rounded-full shadow-xl border border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setIsAutoContrast(!isAutoContrast)}
            title={isAutoContrast ? "Выключить авто-смену фона" : "Включить авто-смену фона"}
            className={`p-1.5 rounded-full transition-colors ${isAutoContrast ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300' : 'hover:bg-zinc-100 text-zinc-400 dark:hover:bg-zinc-800'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          </button>

          {isAutoContrast && (
            <div className="flex items-center gap-2 px-2 border-r border-zinc-200 dark:border-zinc-700">
              <input
                type="range"
                min="0.2"
                max="5"
                step="0.1"
                value={contrastFreq}
                onChange={(e) => setContrastFreq(parseFloat(e.target.value))}
                className="w-16 h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-blue-600"
              />
            </div>
          )}

          <button
            onClick={() => {
              setIsAutoContrast(false);
              setIsDarkBackground(!isDarkBackground);
            }}
            className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
          >
            {isDarkBackground ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            )}
          </button>

          <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1" />

          <button onClick={handleResetView} className="px-2 text-xs font-mono text-zinc-600 dark:text-zinc-300 hover:text-blue-500">
            {(scale * 100).toFixed(0)}%
          </button>
        </div>

        <div
          ref={containerRef}
          // При заливке курсор превращается в прицел
          className={`flex-1 relative overflow-hidden select-none transition-colors ease-in-out ${isDarkBackground ? 'bg-[#111]' : 'bg-[#e5e5e5]'}`}
          style={{
            transitionDuration: `${transitionDurationMs}ms`,
            cursor: isDragging ? 'grabbing' : (processingMode === 'flood-clear' ? 'crosshair' : 'grab')
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity ease-in-out ${isDarkBackground ? 'opacity-10' : 'opacity-30'}`}
            style={{
              transitionDuration: `${transitionDurationMs}ms`,
              backgroundImage: `
                        linear-gradient(45deg, #888 25%, transparent 25%), 
                        linear-gradient(-45deg, #888 25%, transparent 25%), 
                        linear-gradient(45deg, transparent 75%, #888 75%), 
                        linear-gradient(-45deg, transparent 75%, #888 75%)
                    `,
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
            }}
          />

          <div
            className="absolute top-0 left-0 w-full h-full flex items-center justify-center will-change-transform"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: '0 0'
            }}
          >
            {processedUrl ? (
              <div className="relative shadow-2xl">
                <img
                  src={processedUrl}
                  alt="Result"
                  draggable={false}
                  className="max-w-none block"
                />

                {/* Отображение точек заливки для наглядности */}
                {processingMode === 'flood-clear' && floodPoints.map((pt, i) => (
                  <div
                    key={i}
                    className="absolute w-3 h-3 bg-red-500/80 border-2 border-white rounded-full shadow-sm pointer-events-none transform -translate-x-1/2 -translate-y-1/2 animate-bounce"
                    style={{ left: pt.x, top: pt.y }}
                  />
                ))}

                {isProcessing && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center rounded-sm z-50">
                    <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-zinc-400 text-sm pointer-events-none select-none flex flex-col items-center gap-2 opacity-50">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <span>Загрузите изображение</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}