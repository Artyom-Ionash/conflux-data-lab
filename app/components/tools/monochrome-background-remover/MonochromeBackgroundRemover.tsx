'use client';

import { useState, useRef, useEffect, ChangeEvent, MouseEvent as ReactMouseEvent } from 'react';
import { Card } from '../../ui/Card'; // Предполагается наличие этого компонента

interface RGB {
  r: number;
  g: number;
  b: number;
}

export function MonochromeBackgroundRemover() {
  // --- Основные состояния обработки ---
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [processedImageSrc, setProcessedImageSrc] = useState<string | null>(null);
  const [targetColor, setTargetColor] = useState<string>('#ffffff');
  const [tolerance, setTolerance] = useState<number>(20);
  const [smoothness, setSmoothness] = useState<number>(10);

  // --- Состояния для зума и панорамирования ---
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------
  // Логика обработки изображения (без изменений алгоритма)
  // ---------------------------------------------------------
  const processImage = () => {
    if (!imageSrc || !canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imageRef.current;
    // Используем naturalWidth/Height для честной обработки пикселей
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    // Если изображение не загрузилось до конца
    if (w === 0 || h === 0) return;

    canvas.width = w;
    canvas.height = h;

    ctx.drawImage(img, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    const targetRGB = hexToRgb(targetColor);
    if (!targetRGB) return;

    const maxDistance = 441.67;
    const threshold = (tolerance / 100) * maxDistance;
    const smoothRange = (smoothness / 100) * maxDistance;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const distance = Math.sqrt(
        (r - targetRGB.r) ** 2 +
        (g - targetRGB.g) ** 2 +
        (b - targetRGB.b) ** 2
      );

      if (distance < threshold) {
        data[i + 3] = 0;
      } else if (distance < threshold + smoothRange && smoothRange > 0) {
        const alphaFactor = (distance - threshold) / smoothRange;
        data[i + 3] = Math.floor(data[i + 3] * alphaFactor);
      }
    }

    ctx.putImageData(imageData, 0, 0);
    setProcessedImageSrc(canvas.toDataURL('image/png'));
  };

  useEffect(() => {
    if (imageSrc) {
      const timer = setTimeout(() => processImage(), 50);
      return () => clearTimeout(timer);
    }
  }, [targetColor, tolerance, smoothness, imageSrc]);

  // ---------------------------------------------------------
  // Обработчики загрузки и утилит
  // ---------------------------------------------------------
  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageSrc(event.target.result as string);
          resetView(); // Сброс зума при загрузке новой картинки
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageClick = (e: ReactMouseEvent<HTMLImageElement>) => {
    const img = imageRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    const scaleX = img.naturalWidth / rect.width;
    const scaleY = img.naturalHeight / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, -x, -y);
      const p = ctx.getImageData(0, 0, 1, 1).data;
      const hex = rgbToHex(p[0], p[1], p[2]);
      setTargetColor(hex);
    }
  };

  const handleDownload = () => {
    if (processedImageSrc) {
      const link = document.createElement('a');
      link.download = 'processed-image.png';
      link.href = processedImageSrc;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleClear = () => {
    setImageSrc(null);
    setProcessedImageSrc(null);
    resetView();
  };

  const hexToRgb = (hex: string): RGB | null => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const rgbToHex = (r: number, g: number, b: number): string => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  // ---------------------------------------------------------
  // Логика Зума и Панорамирования (Pan & Zoom)
  // ---------------------------------------------------------

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Если нет картинки, не зумим
    if (!processedImageSrc) return;

    e.preventDefault(); // Блокируем скролл страницы, если фокус на канвасе
    const zoomSensitivity = 0.1;
    const delta = e.deltaY > 0 ? -zoomSensitivity : zoomSensitivity;
    const newScale = Math.max(0.1, Math.min(scale + delta, 5)); // Мин 0.1x, Макс 5x
    setScale(newScale);
  };

  const handleMouseDown = (e: ReactMouseEvent) => {
    if (!processedImageSrc) return;
    setIsDragging(true);
    // Запоминаем позицию начала перетаскивания относительно текущих координат
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleMouseMove = (e: ReactMouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  return (
    <div className="space-y-6">
      {/* Скрытый канвас для вычислений */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Grid Layout: Left (Settings) - Right (Canvas) */}
      <div className="grid gap-6 lg:grid-cols-[400px_1fr] items-start">

        {/* --- ЛЕВАЯ ПАНЕЛЬ: НАСТРОЙКИ --- */}
        <div className="flex flex-col gap-6">
          <Card>
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Настройки
                </label>
                <button
                  onClick={handleClear}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                >
                  Сбросить всё
                </button>
              </div>

              {/* Загрузка */}
              {!imageSrc && (
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer bg-zinc-50 hover:bg-zinc-100 border-zinc-300 dark:bg-zinc-800 dark:border-zinc-600 dark:hover:border-zinc-500 dark:hover:bg-zinc-700 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-8 h-8 mb-2 text-zinc-500 dark:text-zinc-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                      </svg>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Загрузить изображение</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </label>
                </div>
              )}

              {/* Контролы */}
              {imageSrc && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">

                  {/* Оригинал + Пипетка */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      1. Выберите цвет для удаления (пипетка)
                    </p>
                    <div className="relative rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-checkerboard cursor-crosshair group h-40 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                      <img
                        ref={imageRef}
                        src={imageSrc}
                        alt="Original"
                        onClick={handleImageClick}
                        onLoad={processImage}
                        className="max-h-full max-w-full object-contain"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors pointer-events-none flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 bg-black/70 text-white text-[10px] px-2 py-1 rounded shadow-sm backdrop-blur-sm">
                          Кликните для выбора цвета
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Цвет */}
                  <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800 p-2 rounded-md border border-zinc-100 dark:border-zinc-700">
                    <input
                      type="color"
                      value={targetColor}
                      onChange={(e) => setTargetColor(e.target.value)}
                      className="h-8 w-8 cursor-pointer rounded border-none bg-transparent"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs text-zinc-500">Выбранный цвет</span>
                      <span className="text-sm font-mono text-zinc-700 dark:text-zinc-300 uppercase">
                        {targetColor}
                      </span>
                    </div>
                  </div>

                  <hr className="border-zinc-200 dark:border-zinc-700" />

                  {/* Слайдеры */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Допуск (Tolerance)
                        </label>
                        <span className="text-xs text-zinc-500 font-mono">{tolerance}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={tolerance}
                        onChange={(e) => setTolerance(Number(e.target.value))}
                        className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-blue-600"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          Сглаживание (Softness)
                        </label>
                        <span className="text-xs text-zinc-500 font-mono">{smoothness}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="50"
                        value={smoothness}
                        onChange={(e) => setSmoothness(Number(e.target.value))}
                        className="w-full h-2 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-blue-600"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Подсказка (переехала вниз левой колонки) */}
          <Card>
            <h4 className="text-xs font-semibold mb-2 text-zinc-900 dark:text-zinc-100">Инструкция</h4>
            <ul className="text-xs text-zinc-600 dark:text-zinc-400 list-disc pl-4 space-y-1">
              <li>Загрузите изображение.</li>
              <li>Кликните по фону на миниатюре.</li>
              <li>Отрегулируйте <b>Допуск</b>, чтобы убрать фон.</li>
              <li>Используйте <b>Сглаживание</b> для мягких краев.</li>
            </ul>
          </Card>
        </div>

        {/* --- ПРАВАЯ ПАНЕЛЬ: РЕЗУЛЬТАТ (ПОЛОТНО) --- */}
        <Card className="h-[calc(100vh-100px)] min-h-[500px] flex flex-col p-0 overflow-hidden">

          {/* Тулбар полотна */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 z-10">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Рабочая область
            </span>
            <div className="flex items-center gap-2">
              {processedImageSrc && (
                <>
                  <span className="text-xs text-zinc-400 mr-2 hidden sm:inline">
                    Колесико для зума, перетаскивание мышью
                  </span>
                  <button
                    onClick={resetView}
                    className="px-3 py-1 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 transition-colors"
                  >
                    100%
                  </button>
                  <button
                    onClick={handleDownload}
                    className="px-3 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors shadow-sm"
                  >
                    Скачать
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Интерактивная область (Canvas Viewport) */}
          <div
            ref={containerRef}
            className="relative flex-1 w-full h-full bg-zinc-100 dark:bg-zinc-950 overflow-hidden select-none"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            {/* Шахматный фон */}
            <div className="absolute inset-0 opacity-40 pointer-events-none"
              style={{
                backgroundImage: 'linear-gradient(45deg, #999 25%, transparent 25%), linear-gradient(-45deg, #999 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #999 75%), linear-gradient(-45deg, transparent 75%, #999 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
              }}
            />

            {/* Контейнер с трансформациями */}
            <div
              className="w-full h-full flex items-center justify-center transition-transform duration-75 ease-linear origin-center will-change-transform"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
              }}
            >
              {processedImageSrc ? (
                <img
                  src={processedImageSrc}
                  alt="Processed Result"
                  draggable={false}
                  className="max-w-none shadow-2xl" // max-w-none важен, чтобы картинку не сплющивало при зуме
                />
              ) : (
                <div className="text-center p-6 opacity-50">
                  <p className="text-sm font-medium text-zinc-500">Результат обработки</p>
                </div>
              )}
            </div>

            {/* Индикатор зума */}
            {processedImageSrc && (
              <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-xs backdrop-blur-sm pointer-events-none">
                {Math.round(scale * 100)}%
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}