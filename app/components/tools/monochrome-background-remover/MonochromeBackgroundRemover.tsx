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

export function MonochromeBackgroundRemover() {
  // --- STATE: Данные изображения ---
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [imgDimensions, setImgDimensions] = useState({ w: 0, h: 0 });

  // --- STATE: Настройки обработки ---
  const [targetColor, setTargetColor] = useState('#ffffff');
  const [tolerance, setTolerance] = useState(20);
  const [smoothness, setSmoothness] = useState(10);

  // --- STATE: Интерфейс и Авто-контраст ---
  const [isDarkBackground, setIsDarkBackground] = useState(true);

  // ИЗМЕНЕНИЕ 1: По умолчанию включено (true)
  const [isAutoContrast, setIsAutoContrast] = useState(true);
  // ИЗМЕНЕНИЕ 2: Частота по умолчанию 1 Гц
  const [contrastFreq, setContrastFreq] = useState(1);

  const [isProcessing, setIsProcessing] = useState(false);

  // --- STATE: Viewport (Зум и Пан) ---
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // --- REFS ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // -------------------------------------------------------------------------
  // ЭФФЕКТ: АВТОМАТИЧЕСКАЯ СМЕНА ФОНА
  // -------------------------------------------------------------------------
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isAutoContrast) {
      // ИЗМЕНЕНИЕ 3: Расчет интервала на основе частоты (ms = 1000 / Hz)
      const ms = 1000 / contrastFreq;

      interval = setInterval(() => {
        setIsDarkBackground(prev => !prev);
      }, ms);
    }

    return () => clearInterval(interval);
  }, [isAutoContrast, contrastFreq]); // Добавили contrastFreq в зависимости

  // ИЗМЕНЕНИЕ 4: Расчет длительности анимации, чтобы она успевала за частотой
  // Берем 90% от периода смены, но не более 2 секунд
  const transitionDurationMs = Math.min(2000, (1000 / contrastFreq) * 0.9);

  // -------------------------------------------------------------------------
  // ЗАГРУЗКА ИЗОБРАЖЕНИЯ
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

      if (containerRef.current) {
        const contW = containerRef.current.clientWidth;
        const scaleFactor = Math.min(1, (contW - 40) / img.width);
        setScale(scaleFactor > 0 ? scaleFactor : 1);
        setOffset({ x: 0, y: 0 });
      }

      // Авто-определение цвета (0,0)
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = 1;
      tempCanvas.height = 1;
      const ctx = tempCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
        const p = ctx.getImageData(0, 0, 1, 1).data;
        const hex = rgbToHex(p[0], p[1], p[2]);
        setTargetColor(hex);
      }
    };
  };

  // -------------------------------------------------------------------------
  // ОБРАБОТКА ИЗОБРАЖЕНИЯ
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

      const targetRGB = hexToRgb(targetColor);
      if (!targetRGB) return;

      const maxDist = 441.67;
      const tolVal = (tolerance / 100) * maxDist;
      const smoothVal = (smoothness / 100) * maxDist;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const dist = Math.sqrt(
          (r - targetRGB.r) ** 2 +
          (g - targetRGB.g) ** 2 +
          (b - targetRGB.b) ** 2
        );

        if (dist <= tolVal) {
          data[i + 3] = 0;
        } else if (dist <= tolVal + smoothVal && smoothVal > 0) {
          const factor = (dist - tolVal) / smoothVal;
          data[i + 3] = Math.floor(data[i + 3] * factor);
        }
      }

      ctx.putImageData(imageData, 0, 0);
      setProcessedUrl(canvas.toDataURL('image/png'));
      setIsProcessing(false);
    };
  }, [originalUrl, targetColor, tolerance, smoothness, imgDimensions]);

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      if (originalUrl) processImage();
    }, 100);
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); }
  }, [processImage]);

  // -------------------------------------------------------------------------
  // VIEWPORT HANDLERS
  // -------------------------------------------------------------------------
  const handleWheel = (e: React.WheelEvent) => {
    if (!processedUrl) return;
    const zoomSpeed = 0.1;
    const delta = e.deltaY > 0 ? -zoomSpeed : zoomSpeed;
    const newScale = Math.max(0.05, Math.min(scale + delta, 10));
    setScale(newScale);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!processedUrl) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    setOffset({ x: newX, y: newY });
  };

  const handlePointerUp = () => setIsDragging(false);

  const handleDownload = () => {
    if (!processedUrl) return;
    const a = document.createElement('a');
    a.href = processedUrl;
    a.download = 'removed-bg.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleResetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
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

  return (
    <div className="flex h-screen w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden font-sans">
      <canvas ref={canvasRef} className="hidden" />

      {/* ================= ЛЕВАЯ ПАНЕЛЬ (НАСТРОЙКИ) ================= */}
      <aside className="w-[360px] flex-shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 shadow-xl">

        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="text-blue-600">Mono</span>Remover
          </h2>
          <p className="text-xs text-zinc-500 mt-1">Удаление однотонного фона</p>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
          {/* 1. Загрузка */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase text-zinc-400">Исходник</label>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 border-zinc-300 dark:bg-zinc-800/50 dark:border-zinc-700 dark:hover:bg-zinc-800 transition-all">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <svg className="w-6 h-6 mb-2 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                <p className="text-xs text-zinc-500">Нажмите для загрузки</p>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
            </label>
          </div>

          {originalUrl && (
            <div className="space-y-6 animate-fade-in">
              {/* 2. Цвет (Пипетка) */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase text-zinc-400">Целевой цвет</label>
                <div className="flex gap-3 items-start">
                  <div className="relative group w-20 h-20 border rounded overflow-hidden cursor-crosshair shrink-0 dark:border-zinc-700 bg-checkerboard">
                    <img src={originalUrl} className="w-full h-full object-cover" alt="mini" onClick={handleEyedropper} />
                    <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors" title="Кликните, чтобы взять цвет" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 p-2 border rounded bg-zinc-50 dark:bg-zinc-800 dark:border-zinc-700">
                      <input
                        type="color"
                        value={targetColor}
                        onChange={(e) => setTargetColor(e.target.value)}
                        className="w-8 h-8 cursor-pointer border-none bg-transparent p-0"
                      />
                      <div className="flex flex-col">
                        <span className="text-[10px] text-zinc-400 uppercase">HEX Code</span>
                        <span className="text-sm font-mono font-bold">{targetColor}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-tight">
                      Авто-определение: (0,0). Кликните по миниатюре для изменения.
                    </p>
                  </div>
                </div>
              </div>

              <hr className="border-zinc-100 dark:border-zinc-800" />

              {/* 3. Слайдеры */}
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">Допуск (Tolerance)</span>
                    <span className="text-blue-500 font-mono">{tolerance}</span>
                  </div>
                  <input
                    type="range" min="0" max="100" step="1"
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-blue-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">Сглаживание (Softness)</span>
                    <span className="text-blue-500 font-mono">{smoothness}</span>
                  </div>
                  <input
                    type="range" min="0" max="50" step="1"
                    value={smoothness}
                    onChange={(e) => setSmoothness(Number(e.target.value))}
                    className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-blue-600"
                  />
                </div>
              </div>

              {/* 4. Кнопка скачивания */}
              <div className="pt-4">
                <button
                  onClick={handleDownload}
                  disabled={!processedUrl}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold text-sm shadow-lg shadow-blue-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Скачать PNG
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ================= ПРАВАЯ ПАНЕЛЬ (ХОЛСТ) ================= */}
      <main className="flex-1 relative flex flex-col bg-zinc-100 dark:bg-[#0a0a0a] overflow-hidden">

        {/* Тулбар холста */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur px-2 py-1.5 rounded-full shadow-lg border border-zinc-200 dark:border-zinc-700">

          {/* Кнопка Авто-Контраст */}
          <button
            onClick={() => setIsAutoContrast(!isAutoContrast)}
            className={`p-2 rounded-full transition-colors ${isAutoContrast ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-zinc-100 text-zinc-600 dark:hover:bg-zinc-800 dark:text-zinc-400'}`}
            title={isAutoContrast ? "Остановить авто-смену фона" : "Запустить авто-смену фона"}
          >
            {isAutoContrast ? (
              /* Pause Icon */
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            ) : (
              /* Play/Loop Icon */
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
          </button>

          {/* ИЗМЕНЕНИЕ 5: Слайдер частоты (показывается только при активном авто-контрасте) */}
          {isAutoContrast && (
            <div className="flex items-center gap-2 px-2 border-r border-zinc-200 dark:border-zinc-700 animate-fade-in">
              <input
                type="range"
                min="0.2"
                max="5"
                step="0.1"
                value={contrastFreq}
                onChange={(e) => setContrastFreq(parseFloat(e.target.value))}
                className="w-20 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-blue-600"
                title="Частота смены (Герц)"
              />
              <span className="text-[10px] font-mono text-zinc-500 w-8 text-right">
                {contrastFreq.toFixed(1)}Hz
              </span>
            </div>
          )}

          {/* Ручной переключатель */}
          <button
            onClick={() => {
              setIsAutoContrast(false); // Выключаем авто если юзер кликнул руками
              setIsDarkBackground(!isDarkBackground);
            }}
            className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 transition-colors"
            title="Сменить фон вручную"
          >
            {isDarkBackground ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
            )}
          </button>

          <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1" />

          <button onClick={handleResetView} className="px-3 py-1 text-xs font-mono text-zinc-600 dark:text-zinc-300 hover:text-blue-500">
            {(scale * 100).toFixed(0)}%
          </button>
        </div>

        {/* Viewport */}
        <div
          ref={containerRef}
          // ИЗМЕНЕНИЕ 6: Используем style для динамического duration, а ease-in-out оставляем в классе
          className={`flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing select-none transition-colors ease-in-out ${isDarkBackground ? 'bg-[#111]' : 'bg-[#e5e5e5]'}`}
          style={{ transitionDuration: `${transitionDurationMs}ms` }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* Шахматная сетка с плавным переходом прозрачности */}
          <div
            className={`absolute inset-0 pointer-events-none transition-opacity ease-in-out ${isDarkBackground ? 'opacity-10' : 'opacity-30'}`}
            style={{
              transitionDuration: `${transitionDurationMs}ms`, // Применяем ту же скорость для сетки
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

          {/* Содержимое */}
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
                {isProcessing && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center text-white text-xs font-bold uppercase tracking-wider animate-pulse">
                    Обработка...
                  </div>
                )}
              </div>
            ) : (
              <div className="text-zinc-400 text-sm pointer-events-none select-none flex flex-col items-center gap-2 opacity-50">
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <span>Нет изображения</span>
              </div>
            )}
          </div>

          {/* Инструкция */}
          {processedUrl && (
            <div className="absolute bottom-5 right-5 text-[10px] text-zinc-500 pointer-events-none text-right space-y-1 opacity-50 hover:opacity-100 transition-opacity">
              <p>Scroll = Zoom</p>
              <p>Drag = Pan</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}