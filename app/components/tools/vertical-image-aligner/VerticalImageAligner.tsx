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

const MAX_CANVAS_HEIGHT = 16000; // защитный лимит, чтобы не упереться в ограничения браузера

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
  // "камера" предпросмотра: масштаб и панорамирование полотна,
  // не влияющие на реальные координаты слоёв для экспорта
  const [cameraScale, setCameraScale] = useState(0.4);
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const cameraStartRef = useRef<{ x: number; y: number } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeImageId = useMemo(
    () => images.find((img) => img.isActive)?.id ?? null,
    [images]
  );

  const handleFilesChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files) return;

      // очищаем старые URL
      setImages((prev) => {
        prev.forEach((img) => revokeObjectURLSafely(img.url));
        return [];
      });

      const nextImages: AlignImage[] = [];
      Array.from(files).forEach((file, index) => {
        if (!file.type.startsWith('image/')) {
          return;
        }
        const url = createObjectURLSafely(file);
        const id = `${Date.now()}-${index}`;

        nextImages.push({
          id,
          file,
          url,
          name: file.name,
          offsetX: 0,
          offsetY: index === 0 ? 0 : 40 * index,
          scale: 1,
          isActive: index === 0,
          naturalWidth: 0,
          naturalHeight: 0,
        });

        // асинхронно читаем натуральный размер изображения, чтобы
        // предпросмотр и экспорт использовали один и тот же bounding-box
        const img = new Image();
        img.onload = () => {
          setImages((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    naturalWidth: img.width,
                    naturalHeight: img.height,
                  }
                : item
            )
          );
        };
        img.src = url;
      });

      setImages(nextImages);
      // сброс инпута, чтобы можно было выбрать те же файлы повторно
      event.target.value = '';
    },
    []
  );

  const handleSelectActive = useCallback((id: string) => {
    setImages((current) =>
      current.map((img) => ({
        ...img,
        isActive: img.id === id,
      }))
    );
  }, []);

  const handleChangeTransform = useCallback(
    (id: string, field: 'offsetX' | 'offsetY' | 'scale', value: number) => {
      setImages((current) =>
        current.map((img) =>
          img.id === id
            ? {
                ...img,
                [field]: value,
              }
            : img
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
            ? {
                ...img,
                offsetX: img.offsetX + deltaX,
                offsetY: img.offsetY + deltaY,
              }
            : img
        )
      );
    },
    [activeImageId]
  );

  // расчёт общего bounding-box композиции с учётом смещений и масштаба,
  // чтобы предпросмотр точно соответствовал тому, что уйдёт в canvas
  const compositionBounds = useMemo(() => {
    if (!images.length) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    let hasSized = false;

    images.forEach((meta) => {
      if (!meta.naturalWidth || !meta.naturalHeight) return;
      hasSized = true;
      const scaledW = meta.naturalWidth * meta.scale;
      const scaledH = meta.naturalHeight * meta.scale;
      const left = meta.offsetX;
      const top = meta.offsetY;
      const right = left + scaledW;
      const bottom = top + scaledH;

      if (left < minX) minX = left;
      if (top < minY) minY = top;
      if (right > maxX) maxX = right;
      if (bottom > maxY) maxY = bottom;
    });

    if (!hasSized) return null;

    const width = Math.max(1, Math.ceil(maxX - minX));
    const height = Math.max(1, Math.ceil(maxY - minY));

    return { minX, minY, width, height };
  }, [images]);

  const handlePreviewWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      event.preventDefault();

      // Ctrl + колесо: локальный масштаб активного слоя (точная настройка)
      if (event.ctrlKey && activeImageId) {
        const delta = event.deltaY > 0 ? -0.05 : 0.05;
        setImages((current) =>
          current.map((img) =>
            img.id === activeImageId
              ? {
                  ...img,
                  scale: Math.min(3, Math.max(0.2, img.scale + delta)),
                }
              : img
          )
        );
        return;
      }

      // Обычное колесо: масштаб "камеры" предпросмотра
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      setCameraScale((prev) => {
        const next = Math.min(4, Math.max(0.1, prev * zoomFactor));
        return next;
      });
    },
    [activeImageId, setImages]
  );

  const handlePreviewPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      // Захват указателя: панорамирование полотна мышью
      try {
        (event.target as HTMLElement).setPointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      setIsPanning(true);
      panStartRef.current = { x: event.clientX, y: event.clientY };
      cameraStartRef.current = { ...cameraOffset };
    },
    [cameraOffset]
  );

  const handlePreviewPointerMove = useCallback(
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
    cameraStartRef.current = null;
  }, []);

  const handleExport = useCallback(async () => {
    if (!images.length) return;

    setIsExporting(true);

    try {
      const loaded = await Promise.all(
        images.map(
          (item) =>
            new Promise<{
              meta: AlignImage;
              image: HTMLImageElement;
              width: number;
              height: number;
            }>((resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                resolve({
                  meta: item,
                  image: img,
                  width: img.width,
                  height: img.height,
                });
              };
              img.onerror = () =>
                reject(new Error(`Не удалось загрузить изображение ${item.name}`));
              img.src = item.url;
            })
        )
      );

      // рассчитываем общий bounding-box с учетом смещений и масштаба
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      loaded.forEach(({ meta, width, height }) => {
        const scaledW = width * meta.scale;
        const scaledH = height * meta.scale;
        const left = meta.offsetX;
        const top = meta.offsetY;
        const right = left + scaledW;
        const bottom = top + scaledH;

        if (left < minX) minX = left;
        if (top < minY) minY = top;
        if (right > maxX) maxX = right;
        if (bottom > maxY) maxY = bottom;
      });

      // нормализуем, чтобы верх был 0, левый - 0
      const width = Math.ceil(maxX - minX);
      const height = Math.ceil(maxY - minY);

      if (!width || !height) {
        throw new Error('Невозможно вычислить размер итогового изображения.');
      }

      if (height > MAX_CANVAS_HEIGHT) {
        throw new Error(
          `Высота итогового изображения (${height}px) превышает безопасный лимит (${MAX_CANVAS_HEIGHT}px). ` +
            'Уменьшите масштаб или высоту композиции.'
        );
      }

      const canvas = canvasRef.current ?? document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Canvas 2D контекст недоступен.');
      }

      ctx.clearRect(0, 0, width, height);

      // рисуем в том же порядке, что и в списке
      loaded.forEach(({ meta, image, width: w, height: h }) => {
        const drawX = meta.offsetX - minX;
        const drawY = meta.offsetY - minY;
        const drawW = w * meta.scale;
        const drawH = h * meta.scale;
        ctx.drawImage(image, drawX, drawY, drawW, drawH);
      });

      // скачивание
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = 'vertical-composite.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : 'Произошла ошибка при генерации изображения.'
      );
    } finally {
      setIsExporting(false);
    }
  }, [images]);

  const handleClear = useCallback(() => {
    setImages((prev) => {
      prev.forEach((img) => revokeObjectURLSafely(img.url));
      return [];
    });
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Вертикальное объединение изображений с калибровкой
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Загрузите несколько изображений, подвиньте и отмасштабируйте каждое в
              предпросмотре с помощью CSS-трансформаций, а затем сгенерируйте
              итоговый PNG только после выравнивания.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/60">
              <span>Загрузить изображения</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFilesChange}
              />
            </label>
            {images.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-600/60"
                >
                  {isExporting ? 'Генерация…' : 'Скачать итоговое PNG'}
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center justify-center rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-800 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800/60"
                >
                  Очистить
                </button>
              </>
            )}
          </div>
        </div>

        {images.length > 0 && (
          <div className="mt-4 flex flex-col gap-4 sm:mt-6 sm:flex-row">
            {/* Панель слоёв и настроек */}
            <div className="w-full space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/40 sm:w-72">
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-800 dark:text-zinc-100">
                  Слои ({images.length})
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Клик по слою — выбор активного
                </span>
              </div>

              <div className="max-h-64 space-y-1 overflow-auto pr-1">
                {images.map((img, index) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => handleSelectActive(img.id)}
                    className={`flex w-full flex-col items-start rounded-md border px-2 py-1.5 text-left text-xs transition ${
                      img.isActive
                        ? 'border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-950/60 dark:text-blue-50'
                        : 'border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/60'
                    }`}
                  >
                    <span className="font-semibold">
                      #{index + 1} {img.name}
                    </span>
                    <span className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      x: {img.offsetX}px, y: {img.offsetY}px, scale:{' '}
                      {img.scale.toFixed(2)}×
                    </span>
                  </button>
                ))}
              </div>

              {activeImageId && (
                <div className="mt-3 space-y-2 rounded-md border border-zinc-200 bg-white p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-medium text-zinc-800 dark:text-zinc-100">
                      Настройки активного
                    </span>
                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Стрелки: тонкий сдвиг
                    </span>
                  </div>
                  <div className="grid grid-cols-[auto,1fr,auto] items-center gap-1.5">
                    <span className="text-zinc-600 dark:text-zinc-300">
                      Сдвиг X
                    </span>
                    <input
                      type="range"
                      min={-1000}
                      max={1000}
                      step={1}
                      value={
                        images.find((i) => i.id === activeImageId)?.offsetX ?? 0
                      }
                      onChange={(e) =>
                        handleChangeTransform(
                          activeImageId,
                          'offsetX',
                          Number(e.target.value)
                        )
                      }
                    />
                    <span className="w-12 text-right text-[11px] text-zinc-500 dark:text-zinc-400">
                      {images
                        .find((i) => i.id === activeImageId)
                        ?.offsetX.toFixed(0)}
                    </span>

                    <span className="text-zinc-600 dark:text-zinc-300">
                      Сдвиг Y
                    </span>
                    <input
                      type="range"
                      min={-1000}
                      max={1000}
                      step={1}
                      value={
                        images.find((i) => i.id === activeImageId)?.offsetY ?? 0
                      }
                      onChange={(e) =>
                        handleChangeTransform(
                          activeImageId,
                          'offsetY',
                          Number(e.target.value)
                        )
                      }
                    />
                    <span className="w-12 text-right text-[11px] text-zinc-500 dark:text-zinc-400">
                      {images
                        .find((i) => i.id === activeImageId)
                        ?.offsetY.toFixed(0)}
                    </span>

                    <span className="text-zinc-600 dark:text-zinc-300">
                      Масштаб
                    </span>
                    <input
                      type="range"
                      min={0.2}
                      max={3}
                      step={0.01}
                      value={
                        images.find((i) => i.id === activeImageId)?.scale ?? 1
                      }
                      onChange={(e) =>
                        handleChangeTransform(
                          activeImageId,
                          'scale',
                          Number(e.target.value)
                        )
                      }
                    />
                    <span className="w-12 text-right text-[11px] text-zinc-500 dark:text-zinc-400">
                      {images
                        .find((i) => i.id === activeImageId)
                        ?.scale.toFixed(2)}
                      ×
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleNudge(-1, 0)}
                      className="rounded border border-zinc-300 px-1 py-1 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNudge(0, -1)}
                      className="rounded border border-zinc-300 px-1 py-1 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNudge(1, 0)}
                      className="rounded border border-zinc-300 px-1 py-1 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      →
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNudge(0, 1)}
                      className="col-span-3 rounded border border-zinc-300 px-1 py-1 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-3 space-y-1.5 rounded-md border border-zinc-200 bg-white p-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">
                    Масштаб предпросмотра
                  </span>
                  <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {Math.round(cameraScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={cameraScale}
                  onChange={(e) => setCameraScale(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <p className="mt-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                Колесо мыши — зум предпросмотра (Ctrl + колесо — масштаб активного
                слоя), перетаскивание полотна — панорамирование. Предпросмотр
                использует только CSS-трансформации, а финальное изображение
                рассчитывается и рендерится в&nbsp;canvas только при нажатии
                на&nbsp;«Скачать итоговое PNG».
              </p>
            </div>

            {/* Превью композиции */}
            <div className="relative min-h-[320px] flex-1 overflow-auto rounded-md border border-zinc-200 bg-zinc-100 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div
                className="relative mx-auto flex min-h-[300px] min-w-[260px] items-center justify-center overflow-hidden"
                onWheel={handlePreviewWheel}
                onPointerDown={handlePreviewPointerDown}
                onPointerMove={handlePreviewPointerMove}
                onPointerUp={stopPanning}
                onPointerLeave={stopPanning}
              >
                {compositionBounds ? (
                  <div
                    className="relative bg-[linear-gradient(to_bottom,#f4f4f5,transparent),linear-gradient(to_right,#f4f4f5,transparent)] bg-[length:100%_40px,40px_100%] dark:bg-[linear-gradient(to_bottom,#18181b,transparent),linear-gradient(to_right,#18181b,transparent)] dark:bg-[length:100%_40px,40px_100%]"
                    style={{
                      width: compositionBounds.width,
                      height: compositionBounds.height,
                      transform: `translate(${cameraOffset.x}px, ${cameraOffset.y}px) scale(${cameraScale})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    {images.map((img, index) => (
                      <div
                        key={img.id}
                        className={`pointer-events-none absolute select-none transition-transform ${
                          img.isActive
                            ? 'z-20 drop-shadow-[0_0_12px_rgba(59,130,246,0.7)]'
                            : 'z-10 drop-shadow-md'
                        }`}
                        style={{
                          left: img.offsetX - compositionBounds.minX,
                          top: img.offsetY - compositionBounds.minY,
                        }}
                      >
                        <img
                          src={img.url}
                          alt={img.name}
                          className="pointer-events-auto max-w-none rounded-md border border-zinc-300 bg-white object-contain dark:border-zinc-700 dark:bg-zinc-900"
                          style={{
                            width: img.naturalWidth || undefined,
                            height: img.naturalHeight || undefined,
                            transform: `scale(${img.scale})`,
                            transformOrigin: 'top left',
                          }}
                          draggable={false}
                        />
                        <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[11px] font-medium text-white">
                          #{index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Загрузка размеров изображений…
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Скрытый canvas для генерации итогового изображения */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}


