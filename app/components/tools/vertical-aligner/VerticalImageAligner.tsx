'use client';

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Canvas, CanvasRef } from '../../ui/Canvas';
import { FileDropzone } from '../../ui/FileDropzone';
import { ToolLayout } from '..//ToolLayout';
import { Switch } from '../../ui/Switch';
import { TextureDimensionSlider } from '../../domain/graphics/TextureDimensionSlider';

// --- Constants ---
const LIMIT_MAX_BROWSER = 16384;

// --- Types ---
type AlignImage = {
  id: string; file: File; url: string; name: string;
  offsetX: number; offsetY: number; isActive: boolean;
  naturalWidth: number; naturalHeight: number;
};

function revokeObjectURLSafely(url: string) { try { URL.revokeObjectURL(url); } catch { } }

// --- Draggable Image Slot ---
interface DraggableImageSlotProps {
  img: AlignImage; index: number; slotHeight: number; slotWidth: number;
  getCanvasScale: () => number; onActivate: (id: string) => void; onUpdatePosition: (id: string, x: number, y: number) => void;
}
const DraggableImageSlot = React.memo(({ img, index, slotHeight, slotWidth, getCanvasScale, onActivate, onUpdatePosition }: DraggableImageSlotProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    onActivate(img.id);
    setIsDragging(true);
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    const initialOffsetX = img.offsetX;
    const initialOffsetY = img.offsetY;
    const scale = getCanvasScale();

    const handlePointerMove = (moveEvent: globalThis.PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / scale;
      const dy = (moveEvent.clientY - startY) / scale;
      onUpdatePosition(img.id, initialOffsetX + dx, initialOffsetY + dy);
    };
    const handlePointerUp = () => {
      setIsDragging(false);
      target.removeEventListener('pointermove', handlePointerMove as EventListener);
      target.removeEventListener('pointerup', handlePointerUp as EventListener);
    };
    target.addEventListener('pointermove', handlePointerMove as EventListener);
    target.addEventListener('pointerup', handlePointerUp as EventListener);
  };

  return (
    <div
      className={`absolute left-0 overflow-hidden group border-r border-dashed transition-colors
        ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
        ${img.isActive ? 'border-blue-500/50 z-30' : 'border-zinc-300/30 z-10 hover:border-zinc-400/50'}
      `}
      style={{ top: index * slotHeight, height: slotHeight, width: slotWidth }}
      onPointerDown={handlePointerDown}
    >
      <div className={`absolute inset-0 transition-colors pointer-events-none ${img.isActive ? 'bg-blue-500/10' : 'group-hover:bg-blue-500/5'}`} />
      <div className={`absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded pointer-events-none select-none z-40 backdrop-blur-sm transition-opacity duration-200 ${img.isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {Math.round(img.offsetX)}, {Math.round(img.offsetY)}
      </div>
      <img src={img.url} draggable={false} alt="" className="absolute select-none origin-top-left max-w-none" style={{ left: 0, top: 0, transform: `translate3d(${img.offsetX}px, ${img.offsetY}px, 0)`, width: img.naturalWidth, height: img.naturalHeight, backfaceVisibility: 'hidden', imageRendering: 'inherit' }} />
    </div>
  );
});
DraggableImageSlot.displayName = 'DraggableImageSlot';

// --- MAIN COMPONENT ---
export function VerticalImageAligner() {
  const [images, setImages] = useState<AlignImage[]>([]);
  const imagesRef = useRef(images);
  useEffect(() => { imagesRef.current = images; }, [images]);

  // Dimensions
  const [slotHeight, setSlotHeight] = useState(1);
  const [slotWidth, setSlotWidth] = useState(1);

  // Grids & Settings
  const [showFrameGrid, setShowFrameGrid] = useState(true);
  const [frameStepX, setFrameStepX] = useState(1);
  const [frameBorderColor] = useState('#00ff00');
  const [showRedGrid, setShowRedGrid] = useState(true);
  const [redGridOffsetX, setRedGridOffsetX] = useState(0);
  const [redGridOffsetY, setRedGridOffsetY] = useState(0);
  const [redGridColor] = useState('#ff0000');
  const [bgColorHex] = useState('#ffffff');
  const [bgOpacity] = useState(0);

  const [draggingListIndex, setDraggingListIndex] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const workspaceRef = useRef<CanvasRef>(null);
  const activeImageId = useMemo(() => images.find((img) => img.isActive)?.id ?? null, [images]);

  useEffect(() => () => imagesRef.current.forEach(img => URL.revokeObjectURL(img.url)), []);

  const { bounds, totalHeight, isCriticalHeight } = useMemo(() => {
    if (!images.length) return { bounds: { width: 1, height: 1 }, totalHeight: 0, isCriticalHeight: false };
    const width = slotWidth;
    const height = Math.max(1, images.length * slotHeight);
    return { bounds: { width, height }, totalHeight: height, isCriticalHeight: height > LIMIT_MAX_BROWSER };
  }, [images.length, slotHeight, slotWidth]);

  const cssBackgroundColor = useMemo(() => {
    const r = parseInt(bgColorHex.slice(1, 3), 16);
    const g = parseInt(bgColorHex.slice(3, 5), 16);
    const b = parseInt(bgColorHex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  }, [bgColorHex, bgOpacity]);

  // Handlers
  const getCanvasScale = useCallback(() => workspaceRef.current?.getTransform().scale || 1, []);
  const handleUpdatePosition = useCallback((id: string, x: number, y: number) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, offsetX: x, offsetY: y } : img));
  }, []);
  const handleCenterAllX = useCallback(() => setImages(prev => prev.map(img => ({ ...img, offsetX: Math.round((slotWidth - img.naturalWidth) / 2) }))), [slotWidth]);
  const handleCenterAllY = useCallback(() => setImages(prev => prev.map(img => ({ ...img, offsetY: Math.round((slotHeight - img.naturalHeight) / 2) }))), [slotHeight]);
  const handleActivate = useCallback((id: string) => setImages(prev => prev.map(x => ({ ...x, isActive: x.id === id }))), []);
  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) revokeObjectURLSafely(target.url);
      return prev.filter((img) => img.id !== id);
    });
  }, []);
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

  const processFiles = useCallback((files: File[]) => {
    if (!files || files.length === 0) return;
    const newImages: AlignImage[] = [];
    const isListEmpty = images.length === 0;
    Array.from(files).forEach((file, index) => {
      if (!file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      const id = `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
      newImages.push({ id, file, url, name: file.name, offsetX: 0, offsetY: 0, isActive: isListEmpty && index === 0, naturalWidth: 0, naturalHeight: 0 });
    });
    setImages((prev) => [...prev, ...newImages]);
    newImages.forEach((item, idx) => {
      const img = new Image();
      img.onload = () => {
        if (isListEmpty && idx === 0) { setSlotHeight(img.height); setFrameStepX(img.height); }
        setSlotWidth(prev => { if (isListEmpty && idx === 0) return img.width; return Math.max(prev, img.width); });
        setImages(current => current.map(ex => ex.id === item.id ? { ...ex, naturalWidth: img.width, naturalHeight: img.height } : ex));
      };
      img.src = item.url;
    });
  }, [images.length]);

  const handleExport = useCallback(async () => {
    if (!images.length || isCriticalHeight) return;
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
      const atlasData = {
        meta: { app: "VerticalImageAligner", version: "1.0", size: { w: finalW, h: finalH }, scale: 1, generated: new Date().toISOString() },
        frames: images.reduce((acc, img, index) => {
          acc[img.name] = {
            frame: { x: 0, y: index * slotHeight, w: slotWidth, h: slotHeight },
            spriteSourceSize: { x: Math.round(img.offsetX), y: Math.round(img.offsetY), w: img.naturalWidth, h: img.naturalHeight },
            sourceSize: { w: slotWidth, h: slotHeight }, rotated: false, trimmed: false
          };
          return acc;
        }, {} as Record<string, any>)
      };
      const pngLink = document.createElement('a'); pngLink.href = canvas.toDataURL('image/png'); pngLink.download = 'aligned-export.png';
      document.body.appendChild(pngLink); pngLink.click(); document.body.removeChild(pngLink);
      setTimeout(() => {
        const jsonString = JSON.stringify(atlasData, null, 2);
        const jsonBlob = new Blob([jsonString], { type: "application/json" });
        const jsonLink = document.createElement('a'); jsonLink.href = URL.createObjectURL(jsonBlob); jsonLink.download = 'aligned-export.json';
        document.body.appendChild(jsonLink); jsonLink.click(); document.body.removeChild(jsonLink); URL.revokeObjectURL(jsonLink.href);
      }, 100);
    } finally { setIsExporting(false); }
  }, [images, slotHeight, slotWidth, bgColorHex, bgOpacity, isCriticalHeight]);

  const sidebarContent = (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-2">
        <FileDropzone onFilesSelected={processFiles} multiple={true} label="Добавить изображения" />
      </div>

      {images.length > 0 && (
        <>
          <div className="space-y-2">
            <button onClick={handleExport} disabled={isExporting || isCriticalHeight} className={`w-full rounded-md py-2.5 text-sm font-semibold text-white transition-all shadow-sm ${isCriticalHeight ? 'bg-zinc-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 hover:shadow-md'}`}>
              {isExporting ? 'Экспорт...' : isCriticalHeight ? 'Размер превышен!' : 'Скачать PNG + JSON'}
            </button>
            {isCriticalHeight && <div className="text-xs text-red-600">Превышен лимит высоты {LIMIT_MAX_BROWSER}px</div>}
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <div className="text-xs font-bold text-zinc-500 mb-3 uppercase tracking-wide">Размеры слота</div>
            {/* TextureDimensionSlider теперь содержит всю логику лимитов и PoT */}
            <TextureDimensionSlider label="Ширина" value={slotWidth} onChange={setSlotWidth} max={16384} />
            <TextureDimensionSlider label="Высота" value={slotHeight} onChange={setSlotHeight} max={16384} />
            <div className="mt-2 text-xs font-medium text-zinc-500 text-center">Итого: <span className="text-zinc-900 dark:text-zinc-100">{slotWidth}</span> x <span className="text-zinc-900 dark:text-zinc-100">{totalHeight}</span> px</div>
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <Switch label="ЗЕЛЕНАЯ СЕТКА (КАДР)" checked={showFrameGrid} onCheckedChange={setShowFrameGrid} />
            {showFrameGrid && <div className="mt-2 pt-4 border-t border-zinc-200 dark:border-zinc-700"><TextureDimensionSlider label="Шаг X" value={frameStepX} onChange={setFrameStepX} max={slotWidth * 2} /></div>}
          </div>

          <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
            <Switch label="КРАСНАЯ СЕТКА (СДВИГ)" checked={showRedGrid} onCheckedChange={setShowRedGrid} />
            {showRedGrid && <div className="mt-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <TextureDimensionSlider label="Сдвиг X" value={redGridOffsetX} onChange={setRedGridOffsetX} min={-slotWidth} max={slotWidth} />
              <TextureDimensionSlider label="Сдвиг Y" value={redGridOffsetY} onChange={setRedGridOffsetY} min={-slotHeight} max={slotHeight} />
            </div>}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between pb-1 px-1">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Слои</span>
              <div className="flex gap-2">
                <button onClick={handleCenterAllX} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded text-zinc-500 transition-colors text-xs font-mono font-bold">|X|</button>
                <button onClick={handleCenterAllY} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded text-zinc-500 transition-colors text-xs font-mono font-bold">≡Y≡</button>
              </div>
            </div>
            {images.map((img, i) => (
              <div key={img.id} draggable onDragStart={(e) => handleDragStart(e, i)} onDragOver={e => e.preventDefault()} onDrop={(e) => handleDrop(e, i)}
                className={`flex items-center gap-3 p-2.5 text-sm rounded-md border cursor-pointer select-none transition-colors ${img.isActive ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-100 shadow-sm' : 'bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'}`}
                onClick={() => handleActivate(img.id)}
              >
                <span className="font-mono text-zinc-400 w-6">#{i + 1}</span>
                <span className="truncate flex-1 font-medium">{img.name}</span>
                <button onClick={(e) => { e.stopPropagation(); handleRemoveImage(img.id); }} className="text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded transition-colors">✕</button>
              </div>
            ))}
          </div>

          {activeImageId && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="font-bold text-xs mb-3 text-yellow-800 dark:text-yellow-200 uppercase tracking-wide">Смещение активного слоя</p>
              <TextureDimensionSlider label="X (px)" value={Math.round(images.find(i => i.id === activeImageId)?.offsetX || 0)} onChange={(val) => handleUpdatePosition(activeImageId, val, (images.find(i => i.id === activeImageId)?.offsetY || 0))} min={-slotWidth} max={slotWidth} />
              <TextureDimensionSlider label="Y (px)" value={Math.round(images.find(i => i.id === activeImageId)?.offsetY || 0)} onChange={(val) => handleUpdatePosition(activeImageId, (images.find(i => i.id === activeImageId)?.offsetX || 0), val)} min={-slotHeight} max={slotHeight} />
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <ToolLayout title="Вертикальный склейщик" sidebar={sidebarContent}>
      <Canvas
        ref={workspaceRef}
        isLoading={isExporting}
        contentWidth={bounds.width}
        contentHeight={bounds.height}
        shadowOverlayOpacity={images.length ? 0.5 : 0}
        showTransparencyGrid={true}
        backgroundColor={cssBackgroundColor}
        placeholder={!images.length}
      >
        {/* User Selected Background Color */}
        <div className="absolute inset-0" style={{ backgroundColor: cssBackgroundColor }} />

        {showRedGrid && (
          <div className="absolute inset-0 pointer-events-none z-50 opacity-50"
            style={{
              backgroundImage: `linear-gradient(to right, ${redGridColor} 1px, transparent 1px), linear-gradient(to bottom, ${redGridColor} 1px, transparent 1px)`,
              backgroundSize: `${frameStepX}px ${slotHeight}px`,
              backgroundPosition: `${redGridOffsetX}px ${redGridOffsetY}px`
            }}
          />
        )}
        {showFrameGrid && (
          <div className="absolute inset-0 pointer-events-none z-[60] opacity-80"
            style={{
              backgroundImage: `linear-gradient(to right, ${frameBorderColor} 10px, transparent 10px), linear-gradient(to bottom, ${frameBorderColor} 10px, transparent 10px)`,
              backgroundSize: `${frameStepX}px ${slotHeight}px`,
              backgroundPosition: '-5px -5px'
            }}
          />
        )}
        {images.map((img, i) => (
          <DraggableImageSlot
            key={img.id} img={img} index={i}
            slotHeight={slotHeight} slotWidth={slotWidth}
            getCanvasScale={getCanvasScale}
            onActivate={handleActivate}
            onUpdatePosition={handleUpdatePosition}
          />
        ))}
      </Canvas>
    </ToolLayout>
  );
}