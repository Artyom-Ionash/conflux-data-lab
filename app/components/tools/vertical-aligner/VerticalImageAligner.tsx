'use client';

import React, { useCallback, useMemo, useState, useRef } from 'react';
import { Canvas, CanvasRef } from '../../ui/Canvas';

type AlignImage = {
  id: string;
  file: File;
  url: string;
  name: string;
  offsetX: number;
  offsetY: number;
  isActive: boolean;
  naturalWidth: number;
  naturalHeight: number;
};

function revokeObjectURLSafely(url: string) { try { URL.revokeObjectURL(url); } catch { } }

// --- Sub-component for performance and clean drag logic ---
interface DraggableImageSlotProps {
  img: AlignImage;
  index: number;
  slotHeight: number;
  slotWidth: number;
  getCanvasScale: () => number;
  onActivate: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
}

const DraggableImageSlot = React.memo(({
  img, index, slotHeight, slotWidth, getCanvasScale, onActivate, onUpdatePosition
}: DraggableImageSlotProps) => {

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (e.button !== 0) return;

    onActivate(img.id);

    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);

    const startX = e.clientX;
    const startY = e.clientY;
    const initialOffsetX = img.offsetX;
    const initialOffsetY = img.offsetY;

    const scale = getCanvasScale();

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;
      onUpdatePosition(img.id, initialOffsetX + dx, initialOffsetY + dy);
    };

    const handlePointerUp = () => {
      target.removeEventListener('pointermove', handlePointerMove as any);
      target.removeEventListener('pointerup', handlePointerUp as any);
    };

    target.addEventListener('pointermove', handlePointerMove as any);
    target.addEventListener('pointerup', handlePointerUp as any);
  };

  return (
    <div
      className={`absolute left-0 overflow-hidden group border-r border-dashed transition-colors
        cursor-grab active:cursor-grabbing
        ${img.isActive
          ? 'border-blue-500/50 z-30'
          : 'border-zinc-300/30 z-10 hover:border-zinc-400/50'
        }
      `}
      style={{
        top: index * slotHeight,
        height: slotHeight,
        width: slotWidth,
      }}
      onPointerDown={handlePointerDown}
    >
      <div className={`absolute inset-0 transition-colors pointer-events-none ${img.isActive ? 'bg-blue-500/10' : 'group-hover:bg-blue-500/5'}`} />

      <div className={`
        absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded 
        pointer-events-none select-none z-40 backdrop-blur-sm transition-opacity duration-200
        ${img.isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
      `}>
        {Math.round(img.offsetX)}, {Math.round(img.offsetY)}
      </div>

      <img
        src={img.url}
        draggable={false}
        alt=""
        className="absolute select-none origin-top-left max-w-none"
        style={{
          left: 0,
          top: 0,
          transform: `translate3d(${img.offsetX}px, ${img.offsetY}px, 0)`,
          width: img.naturalWidth,
          height: img.naturalHeight,
          backfaceVisibility: 'hidden',
          imageRendering: 'inherit'
        }}
      />
    </div>
  );
});
DraggableImageSlot.displayName = 'DraggableImageSlot';


export function VerticalImageAligner() {
  const [images, setImages] = useState<AlignImage[]>([]);

  // --- РАЗМЕРЫ СЛОТА (ОБЛАСТЬ ВИДИМОСТИ И ЭКСПОРТА) ---
  // По умолчанию 1x1, пока не загружено изображение
  const [slotHeight, setSlotHeight] = useState(1);
  const [slotWidth, setSlotWidth] = useState(1);

  // --- ЗЕЛЕНАЯ СЕТКА (ВИЗУАЛЬНАЯ РАМКА) ---
  const [showFrameGrid, setShowFrameGrid] = useState(true);
  const [frameStepX, setFrameStepX] = useState(1); // Шаг X визуальной сетки
  const [frameBorderColor, setFrameBorderColor] = useState('#00ff00');

  // --- КРАСНАЯ СЕТКА (ВСПОМОГАТЕЛЬНАЯ) ---
  const [showRedGrid, setShowRedGrid] = useState(true);
  const [redGridOffsetX, setRedGridOffsetX] = useState(0);
  const [redGridOffsetY, setRedGridOffsetY] = useState(0);
  const [redGridColor, setRedGridColor] = useState('#ff0000');

  const [bgColorHex, setBgColorHex] = useState('#ffffff');
  const [bgOpacity, setBgOpacity] = useState(0);

  const [draggingListIndex, setDraggingListIndex] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const workspaceRef = useRef<CanvasRef>(null);

  const activeImageId = useMemo(() => images.find((img) => img.isActive)?.id ?? null, [images]);

  // --- COMPOSITION BOUNDS ---
  const compositionBounds = useMemo(() => {
    // Если изображений нет, возвращаем 1x1
    if (!images.length) return { width: 1, height: 1 };

    // Ширина холста строго равна ширине слота (которая может быть расширена вручную или авто)
    const width = slotWidth;

    // Высота = сумма высот всех слотов
    const height = Math.max(1, images.length * slotHeight);

    return { width, height };
  }, [images.length, slotHeight, slotWidth]);

  // --- Callbacks ---

  const getCanvasScale = useCallback(() => {
    return workspaceRef.current?.getTransform().scale || 1;
  }, []);

  const handleUpdatePosition = useCallback((id: string, x: number, y: number) => {
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, offsetX: x, offsetY: y } : img
    ));
  }, []);

  const handleActivate = useCallback((id: string) => {
    setImages(prev => prev.map(x => ({ ...x, isActive: x.id === id })));
  }, []);

  const handleFilesChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const newImages: AlignImage[] = [];
    const isListEmpty = images.length === 0;

    Array.from(files).forEach((file, index) => {
      if (!file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      const id = `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
      newImages.push({
        id, file, url, name: file.name,
        offsetX: 0, offsetY: 0,
        isActive: isListEmpty && index === 0,
        naturalWidth: 0, naturalHeight: 0,
      });
    });
    setImages((prev) => [...prev, ...newImages]);

    // Асинхронная загрузка параметров изображений
    newImages.forEach((item, idx) => {
      const img = new Image();
      img.onload = () => {
        // Логика инициализации при первой загрузке (когда список был пуст)
        if (isListEmpty && idx === 0) {
          setSlotHeight(img.height);
          setFrameStepX(img.height); // Зеленая сетка по умолчанию квадратная относительно высоты
        }

        // АВТО-РАСШИРЕНИЕ СЛОТА:
        // Если это первое изображение, ширина слота становится равной его ширине.
        // Если добавляем новые, расширяем слот только если новое фото шире текущего слота.
        setSlotWidth(prev => {
          if (isListEmpty && idx === 0) return img.width;
          return Math.max(prev, img.width);
        });

        setImages(current => current.map(ex => ex.id === item.id ? { ...ex, naturalWidth: img.width, naturalHeight: img.height } : ex));
      };
      img.src = item.url;
    });
    event.target.value = '';
  }, [images.length]);

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) revokeObjectURLSafely(target.url);
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const handleExport = useCallback(async () => {
    if (!images.length) return;
    setIsExporting(true);
    try {
      const loaded = await Promise.all(images.map((item) => new Promise<{ meta: AlignImage; img: HTMLImageElement }>((resolve, reject) => {
        const i = new Image(); i.onload = () => resolve({ meta: item, img: i }); i.onerror = () => reject(); i.src = item.url;
      })));

      const finalW = slotWidth;
      const finalH = images.length * slotHeight;

      const canvas = document.createElement('canvas');
      canvas.width = finalW; canvas.height = finalH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const r = parseInt(bgColorHex.slice(1, 3), 16);
      const g = parseInt(bgColorHex.slice(3, 5), 16);
      const b = parseInt(bgColorHex.slice(5, 7), 16);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
      ctx.fillRect(0, 0, finalW, finalH);

      loaded.forEach(({ meta, img }, index) => {
        const slotY = index * slotHeight;
        ctx.save();
        ctx.beginPath(); ctx.rect(0, slotY, slotWidth, slotHeight); ctx.clip();
        ctx.drawImage(img, meta.offsetX, slotY + meta.offsetY, img.width, img.height);
        ctx.restore();
      });
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'aligned-export.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } finally { setIsExporting(false); }
  }, [images, slotHeight, slotWidth, bgColorHex, bgOpacity]);

  const cssBackgroundColor = useMemo(() => {
    const r = parseInt(bgColorHex.slice(1, 3), 16);
    const g = parseInt(bgColorHex.slice(3, 5), 16);
    const b = parseInt(bgColorHex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  }, [bgColorHex, bgOpacity]);

  const handleDragStart = (e: React.DragEvent, index: number) => { setDraggingListIndex(index); };
  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggingListIndex === null || draggingListIndex === targetIndex) { setDraggingListIndex(null); return; }
    setImages(prev => {
      const copy = [...prev];
      const [item] = copy.splice(draggingListIndex, 1);
      copy.splice(targetIndex, 0, item);
      return copy;
    });
    setDraggingListIndex(null);
  };

  return (
    <div className="fixed inset-0 flex flex-row overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
      <aside className="z-20 flex w-80 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <a href="/" className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg> На главную
          </a>
          <h2 className="mb-1 text-lg font-bold">Вертикальный склейщик</h2>
          <div className="mb-4 flex flex-col gap-2">
            <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800">
              <span className="text-sm font-medium">Добавить изображения</span>
              <input type="file" multiple accept="image/*" className="hidden" onChange={handleFilesChange} />
            </label>
          </div>
          {images.length > 0 && (
            <div className="space-y-4">
              <button onClick={handleExport} disabled={isExporting} className="w-full rounded bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{isExporting ? 'Экспорт...' : 'Скачать PNG'}</button>

              {/* --- GROUP 1: SLOT DIMENSIONS (EXPORT & VIEW) --- */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                <div className="text-xs font-bold text-zinc-500 mb-2 uppercase tracking-wide">Размеры слота</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-400">Ширина</label>
                    <input type="number" value={slotWidth} onChange={e => setSlotWidth(Number(e.target.value))} className="w-full h-8 px-2 text-xs border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-400">Высота</label>
                    <input type="number" value={slotHeight} onChange={e => setSlotHeight(Number(e.target.value))} className="w-full h-8 px-2 text-xs border border-zinc-300 dark:border-zinc-600 rounded bg-white dark:bg-zinc-700" />
                  </div>
                </div>
              </div>

              {/* --- GROUP 2: GREEN GRID (FRAME GUIDE) --- */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide">Зелёная сетка (Кадр)</div>
                  <input type="checkbox" checked={showFrameGrid} onChange={e => setShowFrameGrid(e.target.checked)} />
                </div>
                {showFrameGrid && (
                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-400">Шаг X</label>
                      <input type="number" value={frameStepX} onChange={e => setFrameStepX(Number(e.target.value))} className="w-full h-8 px-2 text-xs border rounded dark:bg-zinc-700 dark:border-zinc-600" />
                    </div>
                  </div>
                )}
              </div>

              {/* --- GROUP 3: RED GRID (OFFSETS) --- */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide">Красная сетка (Сдвиг)</div>
                  <input type="checkbox" checked={showRedGrid} onChange={e => setShowRedGrid(e.target.checked)} />
                </div>
                {showRedGrid && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-400">Сдвиг X</label>
                      <input type="number" value={redGridOffsetX} onChange={e => setRedGridOffsetX(Number(e.target.value))} className="w-full h-8 px-2 text-xs border rounded dark:bg-zinc-700 dark:border-zinc-600" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-400">Сдвиг Y</label>
                      <input type="number" value={redGridOffsetY} onChange={e => setRedGridOffsetY(Number(e.target.value))} className="w-full h-8 px-2 text-xs border rounded dark:bg-zinc-700 dark:border-zinc-600" />
                    </div>
                    <div className="col-span-2 text-[10px] text-zinc-400 italic text-center mt-1">
                      Шаг сетки соответствует Зелёной сетке
                    </div>
                  </div>
                )}
              </div>

              {/* --- LAYERS --- */}
              <div className="space-y-1">
                {images.map((img, i) => (
                  <div key={img.id} draggable onDragStart={(e) => handleDragStart(e, i)} onDragOver={e => e.preventDefault()} onDrop={(e) => handleDrop(e, i)}
                    className={`flex items-center gap-2 p-2 text-xs rounded border cursor-pointer ${img.isActive ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-zinc-200'}`}
                    onClick={() => handleActivate(img.id)}
                  >
                    <span className="font-mono text-zinc-400 w-5">#{i + 1}</span>
                    <span className="truncate flex-1 font-medium">{img.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleRemoveImage(img.id); }} className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors">✕</button>
                  </div>
                ))}
              </div>

              {activeImageId && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                  <p className="font-bold text-xs mb-2 text-yellow-800 dark:text-yellow-200 uppercase">Смещение слоя</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-500">X (px)</label>
                      <input type="number" value={Math.round(images.find(i => i.id === activeImageId)?.offsetX || 0)} onChange={e => handleUpdatePosition(activeImageId, Number(e.target.value), (images.find(i => i.id === activeImageId)?.offsetY || 0))} className="w-full h-8 px-2 text-xs border border-yellow-300 rounded bg-white" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] text-zinc-500">Y (px)</label>
                      <input type="number" value={Math.round(images.find(i => i.id === activeImageId)?.offsetY || 0)} onChange={e => handleUpdatePosition(activeImageId, (images.find(i => i.id === activeImageId)?.offsetX || 0), Number(e.target.value))} className="w-full h-8 px-2 text-xs border border-yellow-300 rounded bg-white" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className="relative flex-1 overflow-hidden">
        <Canvas
          ref={workspaceRef}
          isLoading={isExporting}
          contentWidth={compositionBounds.width}
          contentHeight={compositionBounds.height}
        >
          <div
            className="relative"
            style={{
              width: compositionBounds.width,
              height: compositionBounds.height,
              boxShadow: images.length ? '0 0 0 50000px rgba(0,0,0,0.5)' : 'none'
            }}
          >
            {/* Background */}
            <div className="absolute inset-0" style={{ backgroundColor: cssBackgroundColor }} />

            {/* RED GRID */}
            {showRedGrid && (
              <div className="absolute inset-0 pointer-events-none z-50 opacity-50"
                style={{
                  backgroundImage: `
                        linear-gradient(to right, ${redGridColor} 1px, transparent 1px),
                        linear-gradient(to bottom, ${redGridColor} 1px, transparent 1px)
                    `,
                  // Используем slotHeight как шаг Y, frameStepX как шаг X
                  backgroundSize: `${frameStepX}px ${slotHeight}px`,
                  backgroundPosition: `${redGridOffsetX}px ${redGridOffsetY}px`
                }}
              />
            )}

            {/* GREEN GRID: Frame Borders (10px, offset -5px) */}
            {showFrameGrid && (
              <div className="absolute inset-0 pointer-events-none z-[60] opacity-80"
                style={{
                  backgroundImage: `
                        linear-gradient(to right, ${frameBorderColor} 10px, transparent 10px),
                        linear-gradient(to bottom, ${frameBorderColor} 10px, transparent 10px)
                     `,
                  backgroundSize: `${frameStepX}px ${slotHeight}px`,
                  backgroundPosition: '-5px -5px'
                }}
              />
            )}

            {/* Render Slots */}
            {images.map((img, i) => (
              <DraggableImageSlot
                key={img.id}
                img={img}
                index={i}
                slotHeight={slotHeight}
                slotWidth={slotWidth}
                getCanvasScale={getCanvasScale}
                onActivate={handleActivate}
                onUpdatePosition={handleUpdatePosition}
              />
            ))}

            {!images.length && (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-400">Пустой холст</div>
            )}
          </div>
        </Canvas>
      </main>
    </div>
  );
}