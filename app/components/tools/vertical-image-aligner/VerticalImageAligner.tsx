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

  // Настройки
  const [cellHeight, setCellHeight] = useState(300);

  // Камера
  const [cameraScale, setCameraScale] = useState(0.4);
  const [cameraOffset, setCameraOffset] = useState({ x: 100, y: 50 }); // Начальный сдвиг, чтобы видеть левую границу
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

      // Вычисляем ширину: ищем самую правую точку среди всех изображений
      // Левая точка всегда 0 для экспорта (всё что левее 0 обрезается по логике "полотна")
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
        // Обрезаем по высоте слота
        ctx.beginPath();
        ctx.rect(0, slotY, finalW, cellHeight);
        ctx.clip();

        const drawX = meta.offsetX; // Относительно 0
        const drawY = slotY + meta.offsetY;
        const drawW = img.width * meta.scale;
        const drawH = img.height * meta.scale;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.restore();
      });

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'grid-export.png';
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
            Вертикальные слоты. Правая граница отсутствует.
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

              {/* Настройка высоты слота */}
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium">Высота слота (px):</span>
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    value={cellHeight}
                    onChange={(e) => setCellHeight(Math.max(10, Number(e.target.value)))}
                    className="w-20 rounded border border-zinc-300 bg-white px-1 py-0.5 text-right dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </div>
              </div>

              {/* Список слоев */}
              <div className="max-h-[30vh] space-y-1 overflow-y-auto rounded border border-zinc-200 p-1 dark:border-zinc-800">
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

              {/* Настройки активного слоя */}
              {activeImageId && (
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <div className="mb-2 text-xs font-bold text-zinc-500 uppercase">Активный слой</div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Y (внутри слота)</span>
                        <span className="font-mono">{images.find(i => i.id === activeImageId)?.offsetY.toFixed(0)}</span>
                      </div>
                      <input
                        type="range"
                        min={-cellHeight}
                        max={cellHeight}
                        step={1}
                        className="w-full"
                        value={images.find(i => i.id === activeImageId)?.offsetY ?? 0}
                        onChange={(e) => handleChangeTransform(activeImageId, 'offsetY', Number(e.target.value))}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>X (горизонт.)</span>
                        <span className="font-mono">{images.find(i => i.id === activeImageId)?.offsetX.toFixed(0)}</span>
                      </div>
                      <input
                        type="range"
                        min={-500}
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
                      <button onClick={() => handleNudge(0, -1)} className="col-start-2 rounded bg-zinc-50 border border-zinc-200 py-1 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700">↑</button>
                      <button onClick={() => handleNudge(-1, 0)} className="col-start-1 rounded bg-zinc-50 border border-zinc-200 py-1 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700">←</button>
                      <button onClick={() => handleNudge(1, 0)} className="col-start-3 rounded bg-zinc-50 border border-zinc-200 py-1 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700">→</button>
                      <button onClick={() => handleNudge(0, 1)} className="col-start-2 rounded bg-zinc-50 border border-zinc-200 py-1 hover:bg-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700">↓</button>
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
        {/* Сетка "Миллиметровка" */}
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
            backgroundSize: '20px 20px',
            // Двигаем сетку вместе с камерой, чтобы она была привязана к миру
            backgroundPosition: `${cameraOffset.x}px ${cameraOffset.y}px`
          }}
        />

        {/* Горизонтальные направляющие слотов (красные линии) */}
        {images.length > 0 && (
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-40"
            style={{
              backgroundImage: `linear-gradient(to bottom, #ef4444 1px, transparent 1px)`,
              backgroundSize: `100% ${cellHeight * cameraScale}px`,
              backgroundPosition: `0 ${cameraOffset.y}px`,
            }}
          />
        )}

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
          <div className="absolute top-[-50000px] bottom-[-50000px] w-[50000px] right-[100%] bg-black/60 backdrop-blur-[2px] z-30 pointer-events-none border-r border-white/20">
            {/* Опциональная надпись внутри затемнения */}
            <div className="absolute right-4 top-[50050px] text-white/50 text-4xl font-bold rotate-90 origin-bottom-right whitespace-nowrap">
              OUT OF BOUNDS
            </div>
          </div>

          {images.map((img, i) => (
            // СЛОТ
            <div
              key={img.id}
              // w-[50000px] создает эффект бесконечной правой границы
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
            <p>Перетащите файлы. Они выстроятся в бесконечную вправо ленту.</p>
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