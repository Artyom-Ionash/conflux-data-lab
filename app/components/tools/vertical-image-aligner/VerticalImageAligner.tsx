
'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';

// Типы данных
type AlignImage = {
  id: string;
  file: File;
  url: string;
  name: string;
  offsetX: number;
  offsetY: number;
  scale: number;
  isActive: boolean;
  naturalWidth: number;
  naturalHeight: number;
};

const MAX_CANVAS_HEIGHT = 16000;

function createObjectURLSafely(file: File): string {
  return URL.createObjectURL(file);
}

function revokeObjectURLSafely(url: string) {
  try {
    URL.revokeObjectURL(url);
  } catch {
    // ignore
  }
}

export function VerticalImageAligner() {
  const [images, setImages] = useState<AlignImage[]>([]);

  // Камера
  const [cameraScale, setCameraScale] = useState(0.4);
  const [cameraOffset, setCameraOffset] = useState({ x: 50, y: 50 }); // Чуть сдвинем старт
  const [isPanning, setIsPanning] = useState(false);

  // Линейка
  const [showRuler, setShowRuler] = useState(true);
  const [rulerInterval, setRulerInterval] = useState(0); // 0 = не задано

  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const cameraStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Ref для контейнера превью, чтобы знать его размеры для отрисовки сетки
  const viewportRef = useRef<HTMLDivElement>(null);

  const activeImageId = useMemo(
    () => images.find((img) => img.isActive)?.id ?? null,
    [images]
  );

  // --- Обработчики ---

  const handleFilesChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;

      setImages((prev) => {
        prev.forEach((img) => revokeObjectURLSafely(img.url));
        return [];
      });

      const nextImages: AlignImage[] = [];
      Array.from(files).forEach((file, index) => {
        if (!file.type.startsWith('image/')) return;

        const url = createObjectURLSafely(file);
        const id = `${Date.now()} -${index} `;

        nextImages.push({
          id,
          file,
          url,
          name: file.name,
          offsetX: 0,
          offsetY: index === 0 ? 0 : 100 * index, // временный отступ
          scale: 1,
          isActive: index === 0,
          naturalWidth: 0,
          naturalHeight: 0,
        });

        const img = new Image();
        img.onload = () => {
          // Если это первое изображение, берем его высоту как шаг линейки
          if (index === 0) {
            setRulerInterval(img.height);
          }

          setImages((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, naturalWidth: img.width, naturalHeight: img.height }
                : item
            )
          );
        };
        img.src = url;
      });

      setImages(nextImages);
      event.target.value = '';
    },
    []
  );

  const handleSelectActive = useCallback((id: string) => {
    setImages((current) =>
      current.map((img) => ({ ...img, isActive: img.id === id }))
    );
  }, []);

  const handleChangeTransform = useCallback(
    (id: string, field: 'offsetX' | 'offsetY' | 'scale', value: number) => {
      setImages((current) =>
        current.map((img) =>
          img.id === id ? { ...img, [field]: value } : img
        )
      );
    },
    []
  );

  const handleNudge = useCallback(
    (deltaX: number, deltaY: number) => {
      if (!activeImageId) return;
      setImages((current) =>
        current.map((img) =>
          img.id === activeImageId
            ? { ...img, offsetX: img.offsetX + deltaX, offsetY: img.offsetY + deltaY }
            : img
        )
      );
    },
    [activeImageId]
  );

  // Вычисляем границы контента (для экспорта и центрирования, если нужно)
  const compositionBounds = useMemo(() => {
    if (!images.length) return null;
    let minX = Infinity; let minY = Infinity;
    let maxX = -Infinity; let maxY = -Infinity;
    let hasSized = false;

    images.forEach((meta) => {
      if (!meta.naturalWidth || !meta.naturalHeight) return;
      hasSized = true;
      const w = meta.naturalWidth * meta.scale;
      const h = meta.naturalHeight * meta.scale;
      if (meta.offsetX < minX) minX = meta.offsetX;
      if (meta.offsetY < minY) minY = meta.offsetY;
      if (meta.offsetX + w > maxX) maxX = meta.offsetX + w;
      if (meta.offsetY + h > maxY) maxY = meta.offsetY + h;
    });

    if (!hasSized) return null;
    return { minX, minY, width: maxX - minX, height: maxY - minY, maxX, maxY };
  }, [images]);

  // --- Управление камерой ---

  const handlePreviewWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      // Ctrl + Wheel = зум активного слоя
      if (event.ctrlKey && activeImageId) {
        const delta = event.deltaY > 0 ? -0.05 : 0.05;
        setImages((current) =>
          current.map((img) =>
            img.id === activeImageId
              ? { ...img, scale: Math.min(5, Math.max(0.1, img.scale + delta)) }
              : img
          )
        );
        return;
      }

      // Просто Wheel = зум камеры
      // Зуммируем в точку курсора (приблизительно) или просто в центр
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      setCameraScale((prev) => Math.min(5, Math.max(0.05, prev * zoomFactor)));
    },
    [activeImageId]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Разрешаем перетаскивание только если кликнули не по контролам (хотя тут всё canvas)
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      setIsPanning(true);
      panStartRef.current = { x: event.clientX, y: event.clientY };
      cameraStartRef.current = { ...cameraOffset };
    },
    [cameraOffset]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isPanning || !panStartRef.current || !cameraStartRef.current) return;
      const dx = event.clientX - panStartRef.current.x;
      const dy = event.clientY - panStartRef.current.y;
      setCameraOffset({
        x: cameraStartRef.current.x + dx,
        y: cameraStartRef.current.y + dy,
      });
    },
    [isPanning]
  );

  const stopPanning = useCallback(() => {
    setIsPanning(false);
    panStartRef.current = null;
  }, []);

  // --- Экспорт ---

  const handleExport = useCallback(async () => {
    if (!images.length || !compositionBounds) return;
    setIsExporting(true);
    try {
      // Загружаем все картинки
      const loaded = await Promise.all(
        images.map((item) =>
          new Promise<{ meta: AlignImage; img: HTMLImageElement }>((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve({ meta: item, img: i });
            i.onerror = () => reject();
            i.src = item.url;
          })
        )
      );

      const { width, height, minX, minY } = compositionBounds;
      const finalW = Math.ceil(width);
      const finalH = Math.ceil(height);

      if (finalH > MAX_CANVAS_HEIGHT) throw new Error('Слишком большая высота итогового изображения');

      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = finalW;
      canvas.height = finalH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Context error');

      ctx.clearRect(0, 0, finalW, finalH);

      loaded.forEach(({ meta, img }) => {
        ctx.drawImage(
          img,
          meta.offsetX - minX,
          meta.offsetY - minY,
          img.width * meta.scale,
          img.height * meta.scale
        );
      });

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'collage.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      alert('Ошибка при экспорте');
    } finally {
      setIsExporting(false);
    }
  }, [images, compositionBounds]);

  // --- Рендер ---

  return (
    <div className="fixed inset-0 flex flex-row overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
      {/* --- ЛЕВАЯ ПАНЕЛЬ (НАСТРОЙКИ) --- */}
      <aside className="z-20 flex w-80 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <h2 className="mb-1 text-lg font-bold">Редактор</h2>
          <p className="mb-6 text-xs text-zinc-500 dark:text-zinc-400">
            Загрузите и выровняйте изображения
          </p>

          {/* Кнопка загрузки */}
          <label className="mb-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800">
            <span className="text-sm font-medium">Загрузить файлы</span>
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleFilesChange} />
          </label>

          {images.length > 0 && (
            <div className="space-y-6">
              {/* Экспорт / Очистка */}
              <div className="flex gap-2">
                <button
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex-1 rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isExporting ? '...' : 'Скачать PNG'}
                </button>
                <button
                  onClick={() => setImages([])}
                  className="rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  Сброс
                </button>
              </div>

              {/* Настройки линейки */}
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="mb-2 flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={showRuler}
                      onChange={(e) => setShowRuler(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-300 text-blue-600"
                    />
                    Линейка
                  </label>
                </div>
                {showRuler && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500">Шаг (px):</span>
                      <input
                        type="number"
                        value={rulerInterval}
                        onChange={(e) => setRulerInterval(Number(e.target.value))}
                        className="w-20 rounded border border-zinc-300 bg-transparent px-1 py-0.5 text-right dark:border-zinc-700"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400">
                      Вертикальная линейка с горизонтальными направляющими
                    </p>
                  </div>
                )}
              </div>

              {/* Список слоев */}
              <div>
                <h3 className="mb-2 text-sm font-medium">Слои</h3>
                <div className="max-h-[30vh] space-y-1 overflow-y-auto rounded border border-zinc-200 p-1 dark:border-zinc-800">
                  {images.map((img, i) => (
                    <button
                      key={img.id}
                      onClick={() => handleSelectActive(img.id)}
                      className={`flex w - full items - center justify - between rounded px - 2 py - 1.5 text - xs transition ${img.isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        } `}
                    >
                      <span className="truncate font-medium">
                        #{i + 1} {img.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Настройки активного слоя */}
              {activeImageId && (
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                  <div className="mb-2 text-xs font-bold text-zinc-500 uppercase">Активный слой</div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Позиция Y</span>
                        <span className="font-mono">{images.find(i => i.id === activeImageId)?.offsetY.toFixed(0)}</span>
                      </div>
                      <input
                        type="range"
                        min={-1000}
                        max={5000}
                        step={1}
                        className="w-full"
                        value={images.find(i => i.id === activeImageId)?.offsetY ?? 0}
                        onChange={(e) => handleChangeTransform(activeImageId, 'offsetY', Number(e.target.value))}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Позиция X</span>
                        <span className="font-mono">{images.find(i => i.id === activeImageId)?.offsetX.toFixed(0)}</span>
                      </div>
                      <input
                        type="range"
                        min={-2000}
                        max={2000}
                        step={1}
                        className="w-full"
                        value={images.find(i => i.id === activeImageId)?.offsetX ?? 0}
                        onChange={(e) => handleChangeTransform(activeImageId, 'offsetX', Number(e.target.value))}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Масштаб</span>
                        <span className="font-mono">{images.find(i => i.id === activeImageId)?.scale.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min={0.1}
                        max={3}
                        step={0.01}
                        className="w-full"
                        value={images.find(i => i.id === activeImageId)?.scale ?? 1}
                        onChange={(e) => handleChangeTransform(activeImageId, 'scale', Number(e.target.value))}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-1">
                      <button onClick={() => handleNudge(0, -1)} className="col-start-2 rounded bg-white border border-zinc-200 py-1 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700">↑</button>
                      <button onClick={() => handleNudge(-1, 0)} className="col-start-1 rounded bg-white border border-zinc-200 py-1 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700">←</button>
                      <button onClick={() => handleNudge(1, 0)} className="col-start-3 rounded bg-white border border-zinc-200 py-1 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700">→</button>
                      <button onClick={() => handleNudge(0, 1)} className="col-start-2 rounded bg-white border border-zinc-200 py-1 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700">↓</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* --- ПРАВАЯ ПАНЕЛЬ (ХОЛСТ) --- */}
      <main
        ref={viewportRef}
        className="relative flex-1 overflow-hidden bg-[#e5e5e5] dark:bg-[#111] cursor-grab active:cursor-grabbing"
        onWheel={handlePreviewWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPanning}
        onPointerLeave={stopPanning}
      >
        {/* Сетка фона */}
        <div className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(#000 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        />

        {/* Контейнер "Мира" */}
        <div
          style={{
            transform: `translate(${cameraOffset.x}px, ${cameraOffset.y}px) scale(${cameraScale})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
          className="absolute left-0 top-0"
        >
          {/* SVG слой для ЛИНИЙ линейки (находится в мире, сдвигается, но линии рендерятся тонко) */}
          {showRuler && rulerInterval > 0 && (
            <div
              className="absolute top-[-50000px] bottom-[-50000px] left-[-50000px] right-[-50000px] pointer-events-none z-30"
              style={{
                // Используем repeating-linear-gradient для создания линий
                // Они будут масштабироваться вместе с миром
                backgroundImage: `repeating - linear - gradient(
  to bottom,
  transparent,
  transparent ${rulerInterval - 1}px,
  rgba(255, 50, 50, 0.6) ${rulerInterval - 1}px,
  rgba(255, 50, 50, 0.6) ${rulerInterval}px
)`
              }}
            />
          )}

          {/* Изображения */}
          {images.map((img, i) => (
            <div
              key={img.id}
              className={`absolute select - none transition - shadow ${img.isActive ? 'z-10 shadow-[0_0_0_2px_#3b82f6]' : 'z-0'
                } `}
              style={{
                left: img.offsetX,
                top: img.offsetY,
                width: img.naturalWidth * img.scale,
                height: img.naturalHeight * img.scale,
              }}
            >
              <img
                src={img.url}
                alt=""
                draggable={false}
                className="h-full w-full object-fill"
              />
              {/* Номер слоя */}
              <div className="absolute left-0 top-0 bg-black/70 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">
                #{i + 1}
              </div>
            </div>
          ))}
        </div>

        {/* UI ЛИНЕЙКА (Статичная, прибитая к экрану, но показывающая позицию) */}
        {/* Поскольку требование "фиксированная толщина 10px", мы рисуем её поверх мира */}
        {showRuler && (
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 z-40 flex w-[10px] flex-col border-r border-white/20 bg-red-500/80 shadow-md backdrop-blur-sm">
            {/* Это сама "палка" линейки. Она не двигается при панорамировании X, но линии исходят из неё. 
                Если нужно, чтобы она ездила с камерой по X, её надо поместить внутрь world, 
                но тогда она будет скейлиться.
                Требование "fixed thickness 10px in any scale" говорит о том, что это UI элемент.
            */}
          </div>
        )}

        {!images.length && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-zinc-400">
            <div className="text-center">
              <p>Перетащите файлы или используйте меню слева</p>
            </div>
          </div>
        )}

        {/* Индикатор зума */}
        <div className="absolute bottom-4 right-4 rounded bg-black/60 px-2 py-1 text-xs font-mono text-white backdrop-blur">
          Zoom: {(cameraScale * 100).toFixed(0)}%
        </div>
      </main>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}