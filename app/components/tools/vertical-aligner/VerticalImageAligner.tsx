'use client';

import React, { useCallback, useMemo, useState, useRef, useEffect, ReactNode } from 'react';
import * as Switch from '@radix-ui/react-switch';
import * as Slider from '@radix-ui/react-slider';
import * as ScrollArea from '@radix-ui/react-scroll-area';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Canvas, CanvasRef } from '../../ui/Canvas';

// --- Constants (Limits relevant for 2025) ---
const LIMIT_SAFE_MOBILE = 4096;
const LIMIT_SAFE_PC = 8192;
const LIMIT_MAX_BROWSER = 16384;

// --- Types & Utilities ---

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

// --- UI Components (Radix Wrappers) ---

const LabelledSwitch = ({ checked, onCheckedChange, label }: { checked: boolean; onCheckedChange: (c: boolean) => void; label: string }) => (
  <div className="flex items-center justify-between py-2">
    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer select-none" onClick={() => onCheckedChange(!checked)}>
      {label}
    </label>
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="w-[42px] h-[24px] bg-zinc-300 rounded-full relative shadow-inner focus:shadow-black outline-none cursor-pointer data-[state=checked]:bg-blue-600 dark:bg-zinc-700"
    >
      <Switch.Thumb className="block w-[20px] h-[20px] bg-white rounded-full shadow transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[19px]" />
    </Switch.Root>
  </div>
);

interface LabelledSliderProps {
  value: number;
  onChange: (val: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  limitMobile?: number;
  limitPC?: number;
  limitBrowser?: number;
}

type SliderStatus = 'safe' | 'warning' | 'danger' | 'critical';

const LabelledSlider = ({
  value,
  onChange,
  label,
  min = 0,
  max = 100,
  step = 1,
  limitMobile,
  limitPC,
  limitBrowser
}: LabelledSliderProps) => {

  // Memoize status to satisfy TypeScript strict checks
  const { status, message } = useMemo<{ status: SliderStatus; message: ReactNode }>(() => {
    if (limitBrowser && value > limitBrowser) {
      return {
        status: 'critical',
        message: (
          <>
            <div className="font-bold text-red-200 mb-1">⛔ Технический лимит браузера</div>
            <div className="mb-1">Сторона превышает 16 384 пикселя. Canvas не может отрисовать такое изображение, экспорт заблокирован.</div>
            <div className="opacity-60 text-[10px] uppercase tracking-wider">Ограничение движков (2025 г.)</div>
          </>
        )
      };
    }
    if (limitPC && value > limitPC) {
      return {
        status: 'danger',
        message: (
          <>
            <div className="font-bold text-orange-200 mb-1">☢️ Только для мощного железа</div>
            <div className="mb-1">Сторона {'>'} 8K (8192px). Поддерживается только на High-End ПК и современных консолях. Не подходит для мобильных игр.</div>
            <div className="opacity-60 text-[10px] uppercase tracking-wider">Стандарт 2025 г.</div>
          </>
        )
      };
    }
    if (limitMobile && value > limitMobile) {
      return {
        status: 'warning',
        message: (
          <>
            <div className="font-bold text-yellow-200 mb-1">⚠️ Риск для мобильных устройств</div>
            <div className="mb-1">Сторона {'>'} 4K (4096px). Возможны вылеты приложений на бюджетных и старых смартфонах из-за нехватки памяти.</div>
            <div className="opacity-60 text-[10px] uppercase tracking-wider">Стандарт 2025 г.</div>
          </>
        )
      };
    }
    return { status: 'safe', message: null };
  }, [value, limitBrowser, limitPC, limitMobile]);

  const styles = {
    safe: {
      track: 'bg-blue-500 dark:bg-blue-600',
      thumb: 'border-zinc-300 focus:ring-blue-500',
      text: 'text-zinc-500 dark:text-zinc-400',
      input: 'border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100'
    },
    warning: {
      track: 'bg-yellow-500',
      thumb: 'border-yellow-500 focus:ring-yellow-500',
      text: 'text-yellow-600 dark:text-yellow-500',
      input: 'border-yellow-500 text-yellow-700'
    },
    danger: {
      track: 'bg-orange-500',
      thumb: 'border-orange-500 focus:ring-orange-500',
      text: 'text-orange-600 dark:text-orange-500',
      input: 'border-orange-500 text-orange-700'
    },
    critical: {
      track: 'bg-red-600',
      thumb: 'border-red-600 focus:ring-red-600',
      text: 'text-red-600 dark:text-red-400',
      input: 'border-red-600 text-red-700'
    }
  }[status];

  return (
    <div className="flex flex-col gap-2 mb-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <label className={`text-xs uppercase font-bold tracking-wider transition-colors ${styles.text}`}>
            {label}
          </label>

          {status !== 'safe' && (
            <Tooltip.Provider delayDuration={0}>
              <Tooltip.Root>
                <Tooltip.Trigger asChild>
                  <button className="cursor-help transition-transform hover:scale-110 focus:outline-none p-0.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    {status === 'warning' && <span className="text-sm leading-none">⚠️</span>}
                    {status === 'danger' && <span className="text-sm leading-none">☢️</span>}
                    {status === 'critical' && <span className="text-sm leading-none">⛔</span>}
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    className="z-50 max-w-[260px] bg-zinc-900 text-zinc-100 text-xs p-3 rounded-lg shadow-xl select-none animate-in fade-in zoom-in-95 duration-200 leading-relaxed border border-zinc-700"
                    sideOffset={5}
                    side="top"
                    align="start"
                  >
                    {message}
                    <Tooltip.Arrow className="fill-zinc-900" />
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Provider>
          )}
        </div>

        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className={`w-20 h-8 px-2 text-right text-sm font-medium border rounded bg-white dark:bg-zinc-800 focus:outline-none transition-colors shadow-sm ${styles.input}`}
        />
      </div>

      <Slider.Root
        className="relative flex items-center select-none touch-none w-full h-6 cursor-pointer group"
        value={[value]}
        max={max}
        min={min}
        step={step}
        onValueChange={(val) => onChange(val[0])}
      >
        <Slider.Track className="bg-zinc-200 dark:bg-zinc-700 relative grow rounded-full h-[4px]">
          <Slider.Range className={`absolute rounded-full h-full transition-colors duration-300 ${styles.track}`} />
        </Slider.Track>
        <Slider.Thumb
          className={`block w-4 h-4 bg-white border shadow-md rounded-full hover:scale-110 focus:outline-none focus:ring-2 transition-all duration-200 ${styles.thumb}`}
          aria-label={label}
        />
      </Slider.Root>
    </div>
  );
};

// --- Draggable Slot Component ---

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

  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only accept left mouse button (0)
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

    // Use globalThis.PointerEvent for the native DOM event listener
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

    // Cast to EventListener to satisfy TS strict checks
    target.addEventListener('pointermove', handlePointerMove as EventListener);
    target.addEventListener('pointerup', handlePointerUp as EventListener);
  };

  return (
    <div
      className={`absolute left-0 overflow-hidden group border-r border-dashed transition-colors
        ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
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


// --- Main Component ---

export function VerticalImageAligner() {
  const [images, setImages] = useState<AlignImage[]>([]);
  const imagesRef = useRef(images);
  useEffect(() => { imagesRef.current = images; }, [images]);

  // Dimensions
  const [slotHeight, setSlotHeight] = useState(1);
  const [slotWidth, setSlotWidth] = useState(1);

  // Green Grid
  const [showFrameGrid, setShowFrameGrid] = useState(true);
  const [frameStepX, setFrameStepX] = useState(1);
  const [frameBorderColor, setFrameBorderColor] = useState('#00ff00');

  // Red Grid
  const [showRedGrid, setShowRedGrid] = useState(true);
  const [redGridOffsetX, setRedGridOffsetX] = useState(0);
  const [redGridOffsetY, setRedGridOffsetY] = useState(0);
  const [redGridColor, setRedGridColor] = useState('#ff0000');

  // BG
  const [bgColorHex, setBgColorHex] = useState('#ffffff');
  const [bgOpacity, setBgOpacity] = useState(0);

  const [draggingListIndex, setDraggingListIndex] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const workspaceRef = useRef<CanvasRef>(null);

  const activeImageId = useMemo(() => images.find((img) => img.isActive)?.id ?? null, [images]);

  // Cleanup
  useEffect(() => {
    return () => {
      imagesRef.current.forEach(img => URL.revokeObjectURL(img.url));
    };
  }, []);

  // Composition Bounds & Limits Check
  const { bounds, totalHeight, isCriticalHeight } = useMemo(() => {
    if (!images.length) return { bounds: { width: 1, height: 1 }, totalHeight: 0, isCriticalHeight: false };

    const width = slotWidth;
    const height = Math.max(1, images.length * slotHeight);

    return {
      bounds: { width, height },
      totalHeight: height,
      isCriticalHeight: height > LIMIT_MAX_BROWSER
    };
  }, [images.length, slotHeight, slotWidth]);

  // --- Handlers ---

  const getCanvasScale = useCallback(() => {
    return workspaceRef.current?.getTransform().scale || 1;
  }, []);

  const handleUpdatePosition = useCallback((id: string, x: number, y: number) => {
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, offsetX: x, offsetY: y } : img
    ));
  }, []);

  // Batch Alignment
  const handleCenterAllX = useCallback(() => {
    setImages(prev => prev.map(img => ({
      ...img,
      offsetX: Math.round((slotWidth - img.naturalWidth) / 2)
    })));
  }, [slotWidth]);

  const handleCenterAllY = useCallback(() => {
    setImages(prev => prev.map(img => ({
      ...img,
      offsetY: Math.round((slotHeight - img.naturalHeight) / 2)
    })));
  }, [slotHeight]);

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

    newImages.forEach((item, idx) => {
      const img = new Image();
      img.onload = () => {
        if (isListEmpty && idx === 0) {
          setSlotHeight(img.height);
          setFrameStepX(img.height);
        }
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
        meta: {
          app: "VerticalImageAligner",
          version: "1.0",
          size: { w: finalW, h: finalH },
          scale: 1,
          generated: new Date().toISOString()
        },
        frames: images.reduce((acc, img, index) => {
          acc[img.name] = {
            frame: { x: 0, y: index * slotHeight, w: slotWidth, h: slotHeight },
            spriteSourceSize: { x: Math.round(img.offsetX), y: Math.round(img.offsetY), w: img.naturalWidth, h: img.naturalHeight },
            sourceSize: { w: slotWidth, h: slotHeight },
            rotated: false,
            trimmed: false
          };
          return acc;
        }, {} as Record<string, any>)
      };

      const pngLink = document.createElement('a');
      pngLink.href = canvas.toDataURL('image/png');
      pngLink.download = 'aligned-export.png';
      document.body.appendChild(pngLink);
      pngLink.click();
      document.body.removeChild(pngLink);

      setTimeout(() => {
        const jsonString = JSON.stringify(atlasData, null, 2);
        const jsonBlob = new Blob([jsonString], { type: "application/json" });
        const jsonLink = document.createElement('a');
        jsonLink.href = URL.createObjectURL(jsonBlob);
        jsonLink.download = 'aligned-export.json';
        document.body.appendChild(jsonLink);
        jsonLink.click();
        document.body.removeChild(jsonLink);
        URL.revokeObjectURL(jsonLink.href);
      }, 100);

    } finally { setIsExporting(false); }
  }, [images, slotHeight, slotWidth, bgColorHex, bgOpacity, isCriticalHeight]);

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

        {/* ScrollArea Wrapper */}
        <ScrollArea.Root className="flex-1 w-full overflow-hidden bg-white dark:bg-zinc-900">
          <ScrollArea.Viewport className="w-full h-full p-5">

            <a href="/" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg> На главную
            </a>

            <h2 className="mb-2 text-xl font-bold">Вертикальный склейщик</h2>

            <div className="mb-6 flex flex-col gap-2">
              <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-5 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800">
                <span className="text-sm font-medium">Добавить изображения</span>
                <input type="file" multiple accept="image/*" className="hidden" onChange={handleFilesChange} />
              </label>
            </div>

            {images.length > 0 && (
              <div className="space-y-6 pb-4">

                {/* Export Button with Warning Logic */}
                <div className="space-y-2">
                  <button
                    onClick={handleExport}
                    disabled={isExporting || isCriticalHeight}
                    className={`w-full rounded-md py-2.5 text-sm font-semibold text-white transition-all shadow-sm
                      ${isCriticalHeight
                        ? 'bg-zinc-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 disabled:opacity-50 hover:shadow-md'
                      }`}
                  >
                    {isExporting ? 'Экспорт...' : isCriticalHeight ? 'Размер превышен!' : 'Скачать PNG + JSON'}
                  </button>

                  {isCriticalHeight && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-xs leading-relaxed text-red-700 dark:text-red-200">
                      <strong>⛔ ОШИБКА:</strong> Общая высота {totalHeight}px превышает аппаратный лимит браузера ({LIMIT_MAX_BROWSER}px). Уменьшите высоту слота или количество кадров.
                      <div className="opacity-60 text-[10px] uppercase tracking-wider">Стандарт 2025 г.</div>
                    </div>
                  )}
                </div>

                {/* --- GROUP 1: SLOT DIMENSIONS --- */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <div className="text-xs font-bold text-zinc-500 mb-3 uppercase tracking-wide">Размеры слота</div>
                  <LabelledSlider
                    label="Ширина"
                    value={slotWidth}
                    onChange={setSlotWidth}
                    max={16384}
                    limitMobile={LIMIT_SAFE_MOBILE}
                    limitPC={LIMIT_SAFE_PC}
                    limitBrowser={LIMIT_MAX_BROWSER}
                  />
                  <LabelledSlider
                    label="Высота"
                    value={slotHeight}
                    onChange={setSlotHeight}
                    max={16384}
                    limitMobile={LIMIT_SAFE_MOBILE}
                    limitPC={LIMIT_SAFE_PC}
                    limitBrowser={LIMIT_MAX_BROWSER}
                  />
                  <div className="mt-2 text-xs font-medium text-zinc-500 text-center">
                    Итого: <span className="text-zinc-900 dark:text-zinc-100">{slotWidth}</span> x <span className="text-zinc-900 dark:text-zinc-100">{totalHeight}</span> px
                  </div>
                </div>

                {/* --- GROUP 2: GREEN GRID (FRAME) --- */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <LabelledSwitch
                    label="ЗЕЛЕНАЯ СЕТКА (КАДР)"
                    checked={showFrameGrid}
                    onCheckedChange={setShowFrameGrid}
                  />
                  {showFrameGrid && (
                    <div className="mt-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                      <LabelledSlider
                        label="Шаг X"
                        value={frameStepX}
                        onChange={setFrameStepX}
                        max={slotWidth * 2}
                      />
                    </div>
                  )}
                </div>

                {/* --- GROUP 3: RED GRID (OFFSETS) --- */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <LabelledSwitch
                    label="КРАСНАЯ СЕТКА (СДВИГ)"
                    checked={showRedGrid}
                    onCheckedChange={setShowRedGrid}
                  />
                  {showRedGrid && (
                    <div className="mt-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                      <LabelledSlider
                        label="Сдвиг X"
                        value={redGridOffsetX}
                        onChange={setRedGridOffsetX}
                        min={-slotWidth}
                        max={slotWidth}
                      />
                      <LabelledSlider
                        label="Сдвиг Y"
                        value={redGridOffsetY}
                        onChange={setRedGridOffsetY}
                        min={-slotHeight}
                        max={slotHeight}
                      />
                      <div className="text-xs text-zinc-400 italic text-center mt-2">
                        Шаг красной сетки берется из настроек зеленой
                      </div>
                    </div>
                  )}
                </div>

                {/* --- LAYERS --- */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between pb-1 px-1">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Слои</span>
                    <div className="flex gap-2">
                      <Tooltip.Provider delayDuration={100}>
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <button onClick={handleCenterAllX} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded text-zinc-500 transition-colors">
                              <span className="text-xs font-mono font-bold">|X|</span>
                            </button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content className="z-50 bg-zinc-800 text-white text-[10px] p-2 rounded mb-1 border border-zinc-700 shadow-xl" side="top">Центрировать все по X</Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </Tooltip.Provider>
                      <Tooltip.Provider delayDuration={100}>
                        <Tooltip.Root>
                          <Tooltip.Trigger asChild>
                            <button onClick={handleCenterAllY} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded text-zinc-500 transition-colors">
                              <span className="text-xs font-mono font-bold">≡Y≡</span>
                            </button>
                          </Tooltip.Trigger>
                          <Tooltip.Portal>
                            <Tooltip.Content className="z-50 bg-zinc-800 text-white text-[10px] p-2 rounded mb-1 border border-zinc-700 shadow-xl" side="top">Центрировать все по Y</Tooltip.Content>
                          </Tooltip.Portal>
                        </Tooltip.Root>
                      </Tooltip.Provider>
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
                    <LabelledSlider
                      label="X (px)"
                      value={Math.round(images.find(i => i.id === activeImageId)?.offsetX || 0)}
                      onChange={(val) => handleUpdatePosition(activeImageId, val, (images.find(i => i.id === activeImageId)?.offsetY || 0))}
                      min={-slotWidth}
                      max={slotWidth}
                    />
                    <LabelledSlider
                      label="Y (px)"
                      value={Math.round(images.find(i => i.id === activeImageId)?.offsetY || 0)}
                      onChange={(val) => handleUpdatePosition(activeImageId, (images.find(i => i.id === activeImageId)?.offsetX || 0), val)}
                      min={-slotHeight}
                      max={slotHeight}
                    />
                  </div>
                )}
              </div>
            )}
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar className="flex select-none touch-none p-0.5 bg-zinc-100 dark:bg-zinc-800 transition-colors duration-[160ms] ease-out hover:bg-zinc-200 dark:hover:bg-zinc-700 data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:h-2.5" orientation="vertical">
            <ScrollArea.Thumb className="flex-1 bg-zinc-300 dark:bg-zinc-600 rounded-[10px] relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-full before:h-full before:min-w-[44px] before:min-h-[44px]" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </aside>

      {/* Main Canvas Area */}
      <main className="relative flex-1 overflow-hidden">
        <Canvas
          ref={workspaceRef}
          isLoading={isExporting}
          contentWidth={bounds.width}
          contentHeight={bounds.height}
        >
          <div
            className="relative"
            style={{
              width: bounds.width,
              height: bounds.height,
              boxShadow: images.length ? '0 0 0 50000px rgba(0,0,0,0.5)' : 'none'
            }}
          >
            {/* Checkerboard Pattern for Transparency */}
            <div
              className="absolute inset-0 pointer-events-none z-0"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, #ccc 25%, transparent 25%), 
                  linear-gradient(-45deg, #ccc 25%, transparent 25%), 
                  linear-gradient(45deg, transparent 75%, #ccc 75%), 
                  linear-gradient(-45deg, transparent 75%, #ccc 75%)
                `,
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                backgroundColor: 'white'
              }}
            />

            {/* User Selected Background Color */}
            <div className="absolute inset-0" style={{ backgroundColor: cssBackgroundColor }} />

            {/* RED GRID */}
            {showRedGrid && (
              <div className="absolute inset-0 pointer-events-none z-50 opacity-50"
                style={{
                  backgroundImage: `
                        linear-gradient(to right, ${redGridColor} 1px, transparent 1px),
                        linear-gradient(to bottom, ${redGridColor} 1px, transparent 1px)
                    `,
                  backgroundSize: `${frameStepX}px ${slotHeight}px`,
                  backgroundPosition: `${redGridOffsetX}px ${redGridOffsetY}px`
                }}
              />
            )}

            {/* GREEN GRID */}
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
              <div className="absolute inset-0 flex items-center justify-center text-zinc-400 bg-white/50 backdrop-blur-sm z-10">Пустой холст</div>
            )}
          </div>
        </Canvas>
      </main>
    </div>
  );
}