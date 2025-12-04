'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { CanvasWorkspace } from '../../ui/CanvasWorkspace';

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

export function VerticalImageAligner() {
  const [images, setImages] = useState<AlignImage[]>([]);
  const [cellHeight, setCellHeight] = useState(300);
  const [bgColorHex, setBgColorHex] = useState('#ffffff');
  const [bgOpacity, setBgOpacity] = useState(0);

  // Настройки сетки
  const [showGrid, setShowGrid] = useState(true);
  const [gridWidth, setGridWidth] = useState(100);
  const [gridHeight, setGridHeight] = useState(100);
  const [gridOffsetX, setGridOffsetX] = useState(0);
  const [gridOffsetY, setGridOffsetY] = useState(0);
  const [gridColor, setGridColor] = useState('#ff0000');

  // Настройки границ
  const [showFrameBorders, setShowFrameBorders] = useState(false);
  const [frameWidth, setFrameWidth] = useState(300);
  const [frameBorderColor, setFrameBorderColor] = useState('#00ff00');

  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const activeImageId = useMemo(() => images.find((img) => img.isActive)?.id ?? null, [images]);

  const compositionBounds = useMemo(() => {
    if (!images.length) return { width: 800, height: 600 };
    const height = images.length * cellHeight;
    let maxRight = 0;
    images.forEach((img) => {
      // Scale убран, используем только naturalWidth
      const rightEdge = img.offsetX + img.naturalWidth;
      if (rightEdge > maxRight) maxRight = rightEdge;
    });
    const width = Math.max(800, maxRight, frameWidth * 1.5);
    return { width, height };
  }, [images, cellHeight, frameWidth]);

  // --- Handlers (Upload, Export, etc) ---
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
    newImages.forEach((item, idx) => {
      const img = new Image();
      img.onload = () => {
        if (isListEmpty && idx === 0) { setCellHeight(img.height); setFrameWidth(img.height); }
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
      const finalW = Math.ceil(compositionBounds.width);
      const finalH = compositionBounds.height;
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
        const slotY = index * cellHeight;
        ctx.save(); ctx.beginPath(); ctx.rect(0, slotY, finalW, cellHeight); ctx.clip();
        // Отрисовка без масштабирования
        ctx.drawImage(img, meta.offsetX, slotY + meta.offsetY, img.width, img.height);
        ctx.restore();
      });
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = 'aligned-export.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } finally { setIsExporting(false); }
  }, [images, cellHeight, compositionBounds, bgColorHex, bgOpacity]);

  const cssBackgroundColor = useMemo(() => {
    const r = parseInt(bgColorHex.slice(1, 3), 16);
    const g = parseInt(bgColorHex.slice(3, 5), 16);
    const b = parseInt(bgColorHex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  }, [bgColorHex, bgOpacity]);

  const handleDragStart = (e: React.DragEvent, index: number) => { setDraggingIndex(index); };
  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === targetIndex) { setDraggingIndex(null); return; }
    setImages(prev => {
      const copy = [...prev];
      const [item] = copy.splice(draggingIndex, 1);
      copy.splice(targetIndex, 0, item);
      return copy;
    });
    setDraggingIndex(null);
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
              <div className="space-y-2 p-3 bg-zinc-50 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700 text-xs">
                <div className="flex justify-between items-center"><span className="font-bold">Высота слота</span><input type="number" value={cellHeight} onChange={e => setCellHeight(Number(e.target.value))} className="w-16 p-1 border rounded" /></div>
                <div className="flex justify-between items-center"><span className="font-bold">Сетка</span><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /></div>
                {showGrid && <div className="grid grid-cols-2 gap-2"><input type="number" placeholder="W" value={gridWidth} onChange={e => setGridWidth(Number(e.target.value))} className="border p-1 rounded" /><input type="number" placeholder="H" value={gridHeight} onChange={e => setGridHeight(Number(e.target.value))} className="border p-1 rounded" /></div>}
                <div className="flex justify-between items-center"><span className="font-bold">Границы кадров</span><input type="checkbox" checked={showFrameBorders} onChange={e => setShowFrameBorders(e.target.checked)} /></div>
              </div>
              <div className="space-y-1">
                {images.map((img, i) => (
                  <div key={img.id} draggable onDragStart={(e) => handleDragStart(e, i)} onDragOver={e => e.preventDefault()} onDrop={(e) => handleDrop(e, i)}
                    className={`flex items-center gap-2 p-2 text-xs rounded border cursor-pointer ${img.isActive ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-zinc-200'}`}
                    onClick={() => setImages(p => p.map(x => ({ ...x, isActive: x.id === img.id })))}
                  >
                    <span className="font-mono text-zinc-400">#{i + 1}</span>
                    <span className="truncate flex-1">{img.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleRemoveImage(img.id); }} className="text-red-500 px-2">✕</button>
                  </div>
                ))}
              </div>
              {activeImageId && (
                <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
                  <p className="font-bold mb-1">Активный слой:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {/* Scale удален */}
                    <label>Offset Y <input type="number" value={images.find(i => i.id === activeImageId)?.offsetY} onChange={e => setImages(p => p.map(x => x.id === activeImageId ? { ...x, offsetY: Number(e.target.value) } : x))} className="w-full border" /></label>
                    <label>Offset X <input type="number" value={images.find(i => i.id === activeImageId)?.offsetX} onChange={e => setImages(p => p.map(x => x.id === activeImageId ? { ...x, offsetX: Number(e.target.value) } : x))} className="w-full border" /></label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      <main className="relative flex-1 bg-[#e5e5e5] dark:bg-[#111] overflow-hidden">
        <CanvasWorkspace isLoading={isExporting}>
          <div
            className="relative"
            style={{
              width: compositionBounds.width,
              height: compositionBounds.height,
              boxShadow: images.length ? '0 0 0 50000px rgba(0,0,0,0.5)' : 'none'
            }}
          >
            {/* Фон */}
            <div className="absolute inset-0" style={{ backgroundColor: cssBackgroundColor }} />

            {/* Сетка */}
            {showGrid && (
              <div className="absolute inset-0 pointer-events-none z-50 opacity-50"
                style={{
                  backgroundImage: `
                        linear-gradient(to right, ${gridColor} calc(1px / var(--canvas-scale)), transparent 0),
                        linear-gradient(to bottom, ${gridColor} calc(1px / var(--canvas-scale)), transparent 0)
                    `,
                  backgroundSize: `${gridWidth}px ${gridHeight}px`,
                  backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`
                }}
              />
            )}

            {/* Границы кадров */}
            {showFrameBorders && (
              <div className="absolute inset-0 pointer-events-none z-[60] opacity-80"
                style={{
                  backgroundImage: `
                        linear-gradient(to right, ${frameBorderColor} calc(2px / var(--canvas-scale)), transparent 0),
                        linear-gradient(to bottom, ${frameBorderColor} calc(2px / var(--canvas-scale)), transparent 0)
                     `,
                  backgroundSize: `${frameWidth}px ${cellHeight}px`
                }}
              />
            )}

            {/* Изображения */}
            {images.map((img, i) => (
              <div key={img.id}
                className="absolute left-0 w-full overflow-hidden"
                style={{ top: i * cellHeight, height: cellHeight, zIndex: img.isActive ? 20 : 10 }}
              >
                <div className="absolute top-full left-0 w-full border-b border-dashed border-red-500/30"
                  style={{
                    borderBottomWidth: 'calc(1px / var(--canvas-scale))'
                  }}
                />
                <img
                  src={img.url}
                  alt=""
                  draggable={false}
                  className="absolute select-none origin-top-left"
                  style={{
                    left: img.offsetX,
                    top: img.offsetY,
                    width: img.naturalWidth, // Без масштаба
                    height: img.naturalHeight // Без масштаба
                  }}
                />
                <div className="absolute left-0 top-0 bg-red-600/80 text-white text-[10px] px-1 pointer-events-none" style={{ transformOrigin: 'top left', transform: 'scale(calc(1 / var(--canvas-scale)))' }}>
                  {i + 1}
                </div>
              </div>
            ))}

            {!images.length && (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-400">Пустой холст</div>
            )}
          </div>
        </CanvasWorkspace>
      </main>
    </div>
  );
}