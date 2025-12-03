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

// Вспомогательная функция для конвертации RGB в HEX (для input type="color")
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }).join("");
}

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

  // Настройки фона полотна
  const [bgColorHex, setBgColorHex] = useState('#ffffff');
  const [bgOpacity, setBgOpacity] = useState(0); // По умолчанию прозрачный, пока не загрузим фото

  // Настройки вспомогательной сетки
  const [showGrid, setShowGrid] = useState(true);
  const [gridWidth, setGridWidth] = useState(100);
  const [gridHeight, setGridHeight] = useState(100);
  const [gridOffsetX, setGridOffsetX] = useState(0);
  const [gridOffsetY, setGridOffsetY] = useState(0);
  const [gridColor, setGridColor] = useState('#ff0000');

  // Камера
  const [cameraScale, setCameraScale] = useState(0.4);
  const [cameraOffset, setCameraOffset] = useState({ x: 100, y: 100 });
  const [isPanning, setIsPanning] = useState(false);

  // Drag and Drop
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const cameraStartRef = useRef<{ x: number; y: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const activeImageId = useMemo(
    () => images.find((img) => img.isActive)?.id ?? null,
    [images]
  );

  // Границы композиции
  const compositionBounds = useMemo(() => {
    if (!images.length) return { width: 0, height: 0 };
    const height = images.length * cellHeight;
    let maxRight = 0;
    images.forEach((img) => {
      const rightEdge = img.offsetX + (img.naturalWidth * img.scale);
      if (rightEdge > maxRight) maxRight = rightEdge;
    });
    const width = Math.max(1, maxRight);
    return { width, height };
  }, [images, cellHeight]);

  // --- Обработчики Файлов ---

  const handleFilesChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const newImages: AlignImage[] = [];

      Array.from(files).forEach((file, index) => {
        if (!file.type.startsWith('image/')) return;
        const url = createObjectURLSafely(file);
        const id = `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;

        newImages.push({
          id,
          file,
          url,
          name: file.name,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          isActive: false,
          naturalWidth: 0,
          naturalHeight: 0,
        });
      });

      // Проверяем, пуст ли список до добавления (чтобы понять, нужно ли брать цвет с первого фото)
      // Из-за асинхронности setState используем длину из текущего рендера,
      // но надежнее проверить внутри onload, зная индекс.
      const isListEmpty = images.length === 0;

      setImages((prev) => [...prev, ...newImages]);

      newImages.forEach((item, idx) => {
        const img = new Image();
        img.onload = () => {

          // --- Логика извлечения цвета и размера (только для самого первого фото) ---
          if (isListEmpty && idx === 0) {
            // 1. Установка высоты слота
            setCellHeight(img.height);

            // 2. Извлечение цвета пикселя (0,0)
            try {
              const canvas = document.createElement('canvas');
              canvas.width = 1;
              canvas.height = 1;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                const pixelData = ctx.getImageData(0, 0, 1, 1).data;
                // pixelData = [r, g, b, a] (0-255)
                const hex = rgbToHex(pixelData[0], pixelData[1], pixelData[2]);
                const opacity = Number((pixelData[3] / 255).toFixed(2));

                setBgColorHex(hex);
                setBgOpacity(opacity);
              }
            } catch (e) {
              console.warn("Не удалось извлечь цвет фона (возможно, CORS)", e);
            }
          }

          setImages((currentImages) => {
            return currentImages.map((existingItem) =>
              existingItem.id === item.id
                ? { ...existingItem, naturalWidth: img.width, naturalHeight: img.height }
                : existingItem
            );
          });
        };
        img.src = item.url;
      });

      event.target.value = '';
    },
    [images.length]
  );

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) {
        revokeObjectURLSafely(target.url);
      }
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const handleSelectActive = useCallback((id: string) => {
    setImages((current) =>
      current.map((img) => ({ ...img, isActive: img.id === id }))
    );
  }, []);

  const handleClearAll = useCallback(() => {
    setImages((prev) => {
      prev.forEach(img => revokeObjectURLSafely(img.url));
      return [];
    });
    // Сбрасываем фон при полной очистке, или оставляем - на усмотрение. 
    // Обычно лучше сбросить, чтобы следующее первое фото задало новый фон.
    setBgColorHex('#ffffff');
    setBgOpacity(0);
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

  // --- Drag and Drop ---

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === targetIndex) {
      setDraggingIndex(null);
      return;
    }
    setImages((prev) => {
      const newImages = [...prev];
      const [movedItem] = newImages.splice(draggingIndex, 1);
      newImages.splice(targetIndex, 0, movedItem);
      return newImages;
    });
    setDraggingIndex(null);
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
  };

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

      const finalW = Math.ceil(compositionBounds.width);
      const finalH = compositionBounds.height;

      if (finalH > MAX_CANVAS_HEIGHT) throw new Error('Превышен лимит высоты canvas');

      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = finalW;
      canvas.height = finalH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Context error');

      ctx.clearRect(0, 0, finalW, finalH);

      // 1. Заливка фона
      // Нужно сконвертировать hex + opacity в css строку
      // Но для canvas fillStyle работает rgba(r,g,b,a) или hex. Hex с альфой #RRGGBBAA поддерживается современными браузерами.
      // Для совместимости лучше распарсить hex обратно в rgb.
      const r = parseInt(bgColorHex.slice(1, 3), 16);
      const g = parseInt(bgColorHex.slice(3, 5), 16);
      const b = parseInt(bgColorHex.slice(5, 7), 16);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
      ctx.fillRect(0, 0, finalW, finalH);

      // 2. Отрисовка изображений
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
      a.download = 'aligned-export.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      console.error(e);
      alert('Ошибка экспорта');
    } finally {
      setIsExporting(false);
    }
  }, [images, cellHeight, compositionBounds, bgColorHex, bgOpacity]);

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

      if (!viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;

      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.min(5, Math.max(0.05, cameraScale * zoomFactor));
      const scaleRatio = newScale / cameraScale;

      const newOffsetX = mouseX - (mouseX - cameraOffset.x) * scaleRatio;
      const newOffsetY = mouseY - (mouseY - cameraOffset.y) * scaleRatio;

      setCameraScale(newScale);
      setCameraOffset({ x: newOffsetX, y: newOffsetY });
    },
    [activeImageId, cameraScale, cameraOffset]
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

  // CSS-строка цвета фона для использования в style
  const cssBackgroundColor = useMemo(() => {
    const r = parseInt(bgColorHex.slice(1, 3), 16);
    const g = parseInt(bgColorHex.slice(3, 5), 16);
    const b = parseInt(bgColorHex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  }, [bgColorHex, bgOpacity]);

  // --- Рендер ---

  return (
    <div className="fixed inset-0 flex flex-row overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
      {/* --- ЛЕВАЯ ПАНЕЛЬ --- */}
      <aside className="z-20 flex w-80 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <h2 className="mb-1 text-lg font-bold">Редактор</h2>
          <p className="mb-6 text-xs text-zinc-500 dark:text-zinc-400">
            Фон определяется первым загруженным изображением.
          </p>

          <div className="mb-4 flex flex-col gap-2">
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800">
              <span className="text-sm font-medium">Добавить изображения</span>
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleFilesChange} />
            </label>
            {images.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-red-500 hover:text-red-600 underline self-center"
              >
                Удалить все
              </button>
            )}
          </div>

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
              </div>

              {/* Настройки фона (Филлер) */}
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-zinc-600 dark:text-zinc-400">ФОН (ЗАПОЛНИТЕЛЬ)</span>
                  <div className="h-3 w-3 border border-zinc-300 shadow-sm rounded-full" style={{ backgroundColor: cssBackgroundColor }} />
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span>Цвет</span>
                    <input
                      type="color"
                      value={bgColorHex}
                      onChange={(e) => setBgColorHex(e.target.value)}
                      className="h-5 w-8 p-0 border-none bg-transparent cursor-pointer"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span>Прозр.</span>
                    <input
                      type="range"
                      min="0" max="1" step="0.01"
                      value={bgOpacity}
                      onChange={(e) => setBgOpacity(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-6 text-right">{bgOpacity.toFixed(1)}</span>
                  </div>
                </div>
              </div>

              {/* Настройки высоты слота */}
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-zinc-600 dark:text-zinc-400">ВЫСОТА СЛОТА</span>
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
                    Линейка-Сетка
                  </label>

                  {showGrid && (
                    <input
                      type="color"
                      value={gridColor}
                      onChange={(e) => setGridColor(e.target.value)}
                      className="h-5 w-6 cursor-pointer rounded border-none bg-transparent p-0"
                    />
                  )}
                </div>

                {showGrid && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span>Шаг клетки (W x H)</span>
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

              {/* СПИСОК СЛОЕВ */}
              <div className="flex-1 min-h-0 flex flex-col">
                <h3 className="mb-1 text-xs font-medium uppercase text-zinc-400">Слои (порядок)</h3>
                <div className="flex-1 space-y-1 overflow-y-auto rounded border border-zinc-200 p-1 dark:border-zinc-800">
                  {images.map((img, i) => (
                    <div
                      key={img.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, i)}
                      onDragOver={(e) => handleDragOver(e, i)}
                      onDrop={(e) => handleDrop(e, i)}
                      onDragEnd={handleDragEnd}
                      className={`group flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition border 
                        ${draggingIndex === i ? 'opacity-40 border-dashed border-zinc-400 bg-zinc-100' :
                          img.isActive
                            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-200'
                            : 'border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        }`}
                    >
                      <div className="cursor-move text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-400 flex-shrink-0">
                        <svg width="10" height="14" viewBox="0 0 6 14" fill="currentColor">
                          <circle cx="1.5" cy="2" r="1.5" />
                          <circle cx="4.5" cy="2" r="1.5" />
                          <circle cx="1.5" cy="7" r="1.5" />
                          <circle cx="4.5" cy="7" r="1.5" />
                          <circle cx="1.5" cy="12" r="1.5" />
                          <circle cx="4.5" cy="12" r="1.5" />
                        </svg>
                      </div>

                      <button
                        onClick={() => handleSelectActive(img.id)}
                        className="flex-1 text-left truncate font-medium select-none"
                      >
                        #{i + 1} {img.name}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(img.id);
                        }}
                        className="text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-1 text-sm"
                        title="Удалить слой"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

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
        ref={viewportRef}
        className="relative flex-1 overflow-hidden bg-[#e5e5e5] dark:bg-[#111] cursor-grab active:cursor-grabbing"
        onWheel={handlePreviewWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPanning}
        onPointerLeave={stopPanning}
      >

        {/* 1. МИР */}
        <div
          style={{
            transform: `translate(${cameraOffset.x}px, ${cameraOffset.y}px) scale(${cameraScale})`,
            transformOrigin: '0 0',
            willChange: 'transform',
          }}
          className="absolute left-0 top-0 z-10"
        >
          {images.length > 0 && (
            <>
              {/* 
                 ФОН АКТИВНОЙ ЗОНЫ (Заполнитель) 
                 Этот слой лежит под картинками, но над подложкой мира.
                 Его размер совпадает с активной областью.
              */}
              <div
                className="absolute top-0 left-0 z-0"
                style={{
                  width: compositionBounds.width,
                  height: compositionBounds.height,
                  backgroundColor: cssBackgroundColor
                }}
              />

              {/* МАСКА (Затемнение внешней зоны) */}
              <div
                className="absolute top-0 left-0 pointer-events-none z-30"
                style={{
                  width: compositionBounds.width,
                  height: compositionBounds.height,
                  outline: '50000px solid rgba(0, 0, 0, 0.65)'
                }}
              />

              {/* СЛОТЫ И ИЗОБРАЖЕНИЯ */}
              {images.map((img, i) => (
                <div
                  key={img.id}
                  className={`absolute left-0 w-[50000px] overflow-hidden border-b border-dashed border-red-500/20 transition-all`}
                  style={{
                    top: i * cellHeight,
                    height: cellHeight,
                    zIndex: img.isActive ? 20 : 10
                  }}
                >
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
                  <div className="absolute left-0 top-0 bg-red-600/80 px-1.5 py-0.5 text-[10px] text-white font-mono pointer-events-none opacity-70">
                    {i + 1}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* 2. ВСПОМОГАТЕЛЬНАЯ СЕТКА */}
        {images.length > 0 && showGrid && (
          <div
            className="absolute pointer-events-none z-50"
            style={{
              left: cameraOffset.x,
              top: cameraOffset.y,
              width: compositionBounds.width * cameraScale,
              height: compositionBounds.height * cameraScale,
              backgroundImage: `
                    linear-gradient(to right, ${gridColor} 1px, transparent 1px),
                    linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)
                `,
              backgroundSize: `${gridWidth * cameraScale}px ${gridHeight * cameraScale}px`,
              backgroundPosition: `${gridOffsetX * cameraScale}px ${gridOffsetY * cameraScale}px`,
              overflow: 'hidden'
            }}
          />
        )}

        {!images.length && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-zinc-400 z-20">
            <p>Нажмите "Добавить изображения" слева</p>
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