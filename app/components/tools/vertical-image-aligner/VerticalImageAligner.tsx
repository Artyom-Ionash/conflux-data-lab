'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';

type AlignImage = {
  id: string;
  file: File;
  url: string;
  name: string;
  offsetX: number;
  offsetY: number; // Теперь это сдвиг ВНУТРИ ячейки
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

  // Настройки сцены
  const [cellHeight, setCellHeight] = useState(300); // Высота одной ячейки (шаг)

  // Камера
  const [cameraScale, setCameraScale] = useState(0.4);
  const [cameraOffset, setCameraOffset] = useState({ x: 50, y: 50 });
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
          offsetY: 0, // Сброс локального сдвига
          scale: 1,
          isActive: index === 0,
          naturalWidth: 0,
          naturalHeight: 0,
        });

        const img = new Image();
        img.onload = () => {
          // Если это первое изображение, устанавливаем высоту ячейки по нему
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

  // Вычисляем ширину композиции (высота теперь жестко задана cellHeight * count)
  const compositionBounds = useMemo(() => {
    if (!images.length) return null;
    let minX = Infinity;
    let maxX = -Infinity;

    images.forEach((meta) => {
      if (!meta.naturalWidth) return;
      const w = meta.naturalWidth * meta.scale;
      // Учитываем, где картинка начинается по X
      if (meta.offsetX < minX) minX = meta.offsetX;
      if (meta.offsetX + w > maxX) maxX = meta.offsetX + w;
    });

    if (minX === Infinity) return null;

    // Общая высота = кол-во картинок * высоту ячейки
    const totalHeight = images.length * cellHeight;

    return { minX, width: maxX - minX, totalHeight };
  }, [images, cellHeight]);

  // --- Управление камерой ---

  const handlePreviewWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.ctrlKey && activeImageId) {
        // Зум слоя
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

      // Зум камеры
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

  // --- Экспорт ---

  const handleExport = useCallback(async () => {
    if (!images.length || !compositionBounds) return;
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

      const { width, totalHeight, minX } = compositionBounds;
      const finalW = Math.ceil(width);
      const finalH = Math.ceil(totalHeight);

      if (finalH > MAX_CANVAS_HEIGHT) throw new Error('Превышен лимит высоты canvas');

      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = finalW;
      canvas.height = finalH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Context error');

      // Заливаем прозрачным или белым (по желанию)
      ctx.clearRect(0, 0, finalW, finalH);

      loaded.forEach(({ meta, img }, index) => {
        // Координаты слота
        const slotY = index * cellHeight;

        // 1. Сохраняем контекст
        ctx.save();

        // 2. Создаем область обрезки (Clip) строго по размеру слота
        ctx.beginPath();
        ctx.rect(0, slotY, finalW, cellHeight);
        ctx.clip();

        // 3. Рисуем изображение с учетом его локального сдвига (meta.offsetY)
        // slotY - это "0" для данной картинки в глобальном смысле, + внутренний сдвиг
        const drawX = meta.offsetX - minX;
        const drawY = slotY + meta.offsetY;
        const drawW = img.width * meta.scale;
        const drawH = img.height * meta.scale;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        // 4. Восстанавливаем контекст (убираем clip) для следующей итерации
        ctx.restore();
      });

      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vertical-grid-collage.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
      alert('Ошибка экспорта');
    } finally {
      setIsExporting(false);
    }
  }, [images, compositionBounds, cellHeight]);

  // --- Рендер ---

  return (
    <div className="fixed inset-0 flex flex-row overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
      {/* --- ЛЕВАЯ ПАНЕЛЬ (НАСТРОЙКИ) --- */}
      <aside className="z-20 flex w-80 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <h2 className="mb-1 text-lg font-bold">Сетчатый коллаж</h2>
          <p className="mb-6 text-xs text-zinc-500 dark:text-zinc-400">
            Изображения строго по ячейкам. Лишнее обрезается.
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

              {/* Глобальные настройки сетки */}
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <h3 className="mb-2 text-xs font-bold uppercase text-zinc-500">Параметры сетки</h3>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span>Высота ячейки (px):</span>
                    <input
                      type="number"
                      min={10}
                      max={5000}
                      value={cellHeight}
                      onChange={(e) => setCellHeight(Math.max(10, Number(e.target.value)))}
                      className="w-20 rounded border border-zinc-300 bg-white px-1 py-0.5 text-right dark:border-zinc-700 dark:bg-zinc-800"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-tight">
                    Все изображения будут занимать полосу этой высоты. Всё, что выходит за пределы, будет обрезано.
                  </p>
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
                        <span>Сдвиг внутри (Y)</span>
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
                        <span>Сдвиг горизонт. (X)</span>
                        <span className="font-mono">{images.find(i => i.id === activeImageId)?.offsetX.toFixed(0)}</span>
                      </div>
                      <input
                        type="range"
                        min={-1000}
                        max={1000}
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

      {/* --- ПРАВАЯ ПАНЕЛЬ (ХОЛСТ) --- */}
      <main
        className="relative flex-1 overflow-hidden bg-[#e5e5e5] dark:bg-[#0a0a0a] cursor-grab active:cursor-grabbing"
        onWheel={handlePreviewWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPanning}
        onPointerLeave={stopPanning}
      >
        {/* Фон "Шахматка" для прозрачности */}
        <div className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(45deg, #808080 25%, transparent 25%, transparent 75%, #808080 75%, #808080), 
                              linear-gradient(45deg, #808080 25%, transparent 25%, transparent 75%, #808080 75%, #808080)`,
            backgroundPosition: '0 0, 10px 10px',
            backgroundSize: '20px 20px'
          }}
        />

        {/* Сетка линий (горизонтальные разделители) */}
        {images.length > 0 && (
          <div
            className="absolute inset-0 pointer-events-none z-0 opacity-50"
            style={{
              backgroundImage: `linear-gradient(to bottom, #ff0000 1px, transparent 1px)`,
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
          {images.map((img, i) => (
            // Контейнер ЯЧЕЙКИ (Clip mask)
            // Он имеет фиксированную высоту cellHeight и обрезает всё, что внутри
            <div
              key={img.id}
              className={`absolute left-0 w-[5000px] overflow-hidden border-b border-dashed border-red-500/30 transition-all`}
              style={{
                top: i * cellHeight,
                height: cellHeight,
                // Если слой активен, можно подсветить границы ячейки
                backgroundColor: img.isActive ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
              }}
            >
              {/* Само изображение. Оно может быть сдвинуто ВНУТРИ ячейки */}
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
                  className={`w-full h-full object-fill select-none ${img.isActive ? 'ring-2 ring-blue-500' : ''}`}
                />
              </div>

              {/* Номер ячейки */}
              <div className="absolute left-0 top-0 bg-red-500/80 px-1.5 py-0.5 text-[10px] text-white font-mono z-30 pointer-events-none">
                Slot #{i + 1}
              </div>
            </div>
          ))}
        </div>

        {!images.length && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-zinc-400 z-20">
            <div className="text-center">
              <p>Загрузите изображения</p>
              <p className="text-sm opacity-70">Они встанут в вертикальный стек</p>
            </div>
          </div>
        )}

        <div className="absolute bottom-4 right-4 z-30 rounded bg-black/60 px-2 py-1 text-xs font-mono text-white backdrop-blur">
          Zoom: {(cameraScale * 100).toFixed(0)}%
        </div>
      </main>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}