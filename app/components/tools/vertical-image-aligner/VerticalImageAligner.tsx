'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';

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

  // Настройки слотов
  const [cellHeight, setCellHeight] = useState(300);

  // Настройки вспомогательной сетки (Overlay Grid)
  const [showGrid, setShowGrid] = useState(true);
  const [gridWidth, setGridWidth] = useState(100);
  const [gridHeight, setGridHeight] = useState(100);
  const [gridOffsetX, setGridOffsetX] = useState(0);
  const [gridOffsetY, setGridOffsetY] = useState(0);
  const [gridColor, setGridColor] = useState('#ff0000'); // Красный по умолчанию

  // Камера
  const [cameraScale, setCameraScale] = useState(0.4);
  const [cameraOffset, setCameraOffset] = useState({ x: 100, y: 50 });
  const [isPanning, setIsPanning] = useState(false);

  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const cameraStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
        const id = `${Date.now()}-${index}`;

        nextImages.push({
          id,
          file,
          url,
          name: file.name,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          isActive: index === 0,
          naturalWidth: 0,
          naturalHeight: 0,
        });

        const img = new Image();
        img.onload = () => {
          if (index === 0) {
            setCellHeight(img.height);
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

  // --- Экспорт ---

  const handleExport = useCallback(async () => {
    if (!images.length) return;
    setIsExporting(true);
    try {
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

      let maxRight = 0;
      loaded.forEach(({ meta, img }) => {
        const rightEdge = meta.offsetX + (img.width * meta.scale);
        if (rightEdge > maxRight) maxRight = rightEdge;
      });

      const finalW = Math.ceil(Math.max(1, maxRight));
      const finalH = images.length * cellHeight;

      if (finalH > MAX_CANVAS_HEIGHT) throw new Error('Превышен лимит высоты canvas');

      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = finalW;
      canvas.height = finalH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Context error');

      ctx.clearRect(0, 0, finalW, finalH);

      loaded.forEach(({ meta, img }, index) => {
        const slotY = index * cellHeight;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, slotY, finalW, cellHeight);
        ctx.clip();

        const drawX = meta.offsetX;
        const drawY = slotY + meta.offsetY;
        const drawW = img.width * meta.scale;
        const drawH = img.height * meta.scale;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.restore();
      });

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'aligned-grid.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
      alert('Ошибка экспорта');
    } finally {
      setIsExporting(false);
    }
  }, [images, cellHeight]);

  // --- Управление камерой ---

  const handlePreviewWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

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
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      setCameraScale((prev) => Math.min(5, Math.max(0.05, prev * zoomFactor)));
    },
    [activeImageId]
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
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

  // --- Рендер ---

  return (
    <div className="fixed inset-0 flex flex-row overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
      {/* --- ЛЕВАЯ ПАНЕЛЬ --- */}
      <aside className="z-20 flex w-80 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <h2 className="mb-1 text-lg font-bold">Редактор</h2>
          <p className="mb-6 text-xs text-zinc-500 dark:text-zinc-400">
            Выравнивание по слотам и передней сетке.
          </p>

          <label className="mb-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800">
            <span className="text-sm font-medium">Загрузить файлы</span>
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleFilesChange} />
          </label>

          {images.length > 0 && (
            <div className="space-y-6">
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

              {/* Настройки высоты слота */}
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-zinc-600 dark:text-zinc-400">ВЫСОТА СЛОТА (обрезка)</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    value={cellHeight}
                    onChange={(e) => setCellHeight(Math.max(10, Number(e.target.value)))}
                    className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
                  />
                  <span className="text-xs text-zinc-500">px</span>
                </div>
              </div>

              {/* Настройки ВСПОМОГАТЕЛЬНОЙ СЕТКИ */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                <div className="mb-3 flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-bold uppercase text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={(e) => setShowGrid(e.target.checked)}
                      className="h-4 w-4 rounded border-zinc-400"
                    />
                    Сетка (Helper)
                  </label>

                  {/* ПАЛИТРА ЦВЕТА */}
                  {showGrid && (
                    <input
                      type="color"
                      value={gridColor}
                      onChange={(e) => setGridColor(e.target.value)}
                      className="h-5 w-6 cursor-pointer rounded border-none bg-transparent p-0"
                      title="Цвет сетки"
                    />
                  )}
                </div>

                {showGrid && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Размер клетки (W x H)</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="number" placeholder="W"
                          className="w-full rounded border border-zinc-300 px-1 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                          value={gridWidth} onChange={(e) => setGridWidth(Number(e.target.value))}
                        />
                        <input
                          type="number" placeholder="H"
                          className="w-full rounded border border-zinc-300 px-1 py-1 dark:border-zinc-700 dark:bg-zinc-800"
                          value={gridHeight} onChange={(e) => setGridHeight(Number(e.target.value))}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Сдвиг сетки (X / Y)</span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-3 text-zinc-500">X</span>
                          <input
                            type="range" min={-500} max={500}
                            className="flex-1"
                            value={gridOffsetX} onChange={(e) => setGridOffsetX(Number(e.target.value))}
                          />
                          <span className="w-8 text-right">{gridOffsetX}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 text-zinc-500">Y</span>
                          <input
                            type="range" min={-500} max={500}
                            className="flex-1"
                            value={gridOffsetY} onChange={(e) => setGridOffsetY(Number(e.target.value))}
                          />
                          <span className="w-8 text-right">{gridOffsetY}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Список слоев */}
              <div className="flex-1 min-h-0 flex flex-col">
                <h3 className="mb-1 text-xs font-medium uppercase text-zinc-400">Слои</h3>
                <div className="flex-1 space-y-1 overflow-y-auto rounded border border-zinc-200 p-1 dark:border-zinc-800">
                  {images.map((img, i) => (
                    <button
                      key={img.id}
                      onClick={() => handleSelectActive(img.id)}
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-xs transition ${img.isActive
                          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200'
                          : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                    >
                      <span className="truncate font-medium">
                        #{i + 1} {img.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Настройки активного */}
              {activeImageId && (
                <div className="rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-800/50">
                  <div className="mb-2 font-bold text-zinc-500">Активный слой</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label>Сдвиг Y</label>
                      <input
                        type="number"
                        className="w-full rounded border px-1"
                        value={images.find(i => i.id === activeImageId)?.offsetY}
                        onChange={(e) => handleChangeTransform(activeImageId, 'offsetY', Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label>Сдвиг X</label>
                      <input
                        type="number"
                        className="w-full rounded border px-1"
                        value={images.find(i => i.id === activeImageId)?.offsetX}
                        onChange={(e) => handleChangeTransform(activeImageId, 'offsetX', Number(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* --- ПРАВАЯ ПАНЕЛЬ --- */}
      <main
        className="relative flex-1 overflow-hidden bg-[#e5e5e5] dark:bg-[#111] cursor-grab active:cursor-grabbing"
        onWheel={handlePreviewWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPanning}
        onPointerLeave={stopPanning}
      >

        {/* Контейнер "Мира" */}
        <div
          style={{
            transform: `translate(${cameraOffset.x}px, ${cameraOffset.y}px) scale(${cameraScale})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
          className="absolute left-0 top-0 z-10"
        >
          {/* --- ЗАТЕНЕНИЕ ЛЕВОЙ ГРАНИЦЫ (x < 0) --- */}
          <div className="absolute top-[-50000px] bottom-[-50000px] w-[50000px] right-[100%] bg-black/60 backdrop-blur-[2px] z-40 pointer-events-none border-r border-white/20"></div>

          {/* --- ВСПОМОГАТЕЛЬНАЯ СЕТКА (OVERLAY GRID) --- */}
          {showGrid && images.length > 0 && (
            <div
              className="absolute left-0 z-50 pointer-events-none"
              style={{
                top: 0,
                width: '50000px',
                height: images.length * cellHeight,
                // Используем выбранный gridColor для градиента
                backgroundImage: `
                        linear-gradient(to right, ${gridColor} 1px, transparent 1px),
                        linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)
                    `,
                backgroundSize: `${gridWidth}px ${gridHeight}px`,
                backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`
              }}
            />
          )}

          {/* СЛОТЫ И ИЗОБРАЖЕНИЯ */}
          {images.map((img, i) => (
            <div
              key={img.id}
              className={`absolute left-0 w-[50000px] overflow-hidden border-b border-dashed border-red-500/20 transition-all`}
              style={{
                top: i * cellHeight,
                height: cellHeight,
              }}
            >
              {/* Изображение */}
              <div
                className="relative"
                style={{
                  transform: `translate(${img.offsetX}px, ${img.offsetY}px)`,
                  width: img.naturalWidth * img.scale,
                  height: img.naturalHeight * img.scale,
                }}
              >
                <img
                  src={img.url}
                  alt=""
                  draggable={false}
                  className={`w-full h-full object-fill select-none ${img.isActive ? 'ring-2 ring-blue-500 shadow-lg' : ''}`}
                />
              </div>

              {/* Маркер слота */}
              <div className="absolute left-0 top-0 bg-red-600/80 px-1.5 py-0.5 text-[10px] text-white font-mono z-20 pointer-events-none opacity-70">
                {i + 1}
              </div>
            </div>
          ))}
        </div>

        {!images.length && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-zinc-400 z-20">
            <p>Перетащите файлы</p>
          </div>
        )}

        <div className="absolute bottom-4 right-4 z-30 rounded bg-black/60 px-2 py-1 text-xs font-mono text-white backdrop-blur pointer-events-none">
          Zoom: {(cameraScale * 100).toFixed(0)}%
        </div>
      </main>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}