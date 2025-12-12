'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { rgbToHex } from '@/lib/utils/colors';
import { downloadDataUrl, loadImage, revokeObjectURLSafely } from '@/lib/utils/media';

import { TextureDimensionSlider } from '../../entities/hardware/TextureDimensionSlider';
import { Canvas, CanvasRef } from '../../primitives/Canvas';
// Импортируем ControlSection и ControlLabel из одного файла
import { ControlLabel, ControlSection } from '../../primitives/ControlSection';
import { FileDropzone, FileDropzonePlaceholder } from '../../primitives/FileDropzone';
import { Slider } from '../../primitives/Slider';
import { Switch } from '../../primitives/Switch';
import { ToolLayout } from '../ToolLayout';

// --- CONSTANTS ---
const LIMIT_MAX_BROWSER = 16_384;
const VIEW_RESET_DELAY = 50;
const EXPORT_FILENAME = 'aligned-export.png';
const MOUSE_BUTTON_LEFT = 0;
const CANVAS_SCALE_DEFAULT = 1;

const GRID_FRAME_DASH = 10;
const GRID_FRAME_OFFSET_CSS = '-5px -5px';

const Z_INDEX_SLOT_BASE = 10;
const Z_INDEX_SLOT_ACTIVE = 30;
const Z_INDEX_LABEL = 40;
const Z_INDEX_GRID_RED = 50;
const Z_INDEX_GRID_FRAME = 60;

const DEFAULT_SETTINGS = {
  slotSize: 1,
  frameStep: 1,
  frameColor: '#00ff00',
  redGridColor: '#ff0000',
  bgColor: '#ffffff',
};

// --- TYPES ---
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

// --- DRAGGABLE IMAGE SLOT ---
interface DraggableImageSlotProps {
  img: AlignImage;
  index: number;
  slotHeight: number;
  slotWidth: number;
  getCanvasScale: () => number;
  onActivate: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
}

const DraggableImageSlot = React.memo(
  ({
    img,
    index,
    slotHeight,
    slotWidth,
    getCanvasScale,
    onActivate,
    onUpdatePosition,
  }: DraggableImageSlotProps) => {
    const [isDragging, setIsDragging] = useState(false);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== MOUSE_BUTTON_LEFT) return;
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

    const zIndexClass = img.isActive ? `z-${Z_INDEX_SLOT_ACTIVE}` : `z-${Z_INDEX_SLOT_BASE}`;
    const borderClass = img.isActive
      ? 'border-blue-500 ring-1 ring-blue-500'
      : 'border-zinc-300/30 hover:border-zinc-400/50';

    return (
      <div
        className={`group absolute left-0 overflow-hidden border-r border-dashed transition-colors ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${borderClass} ${zIndexClass} `}
        style={{
          top: index * slotHeight,
          height: slotHeight,
          width: slotWidth,
          zIndex: img.isActive ? Z_INDEX_SLOT_ACTIVE : Z_INDEX_SLOT_BASE,
        }}
        onPointerDown={handlePointerDown}
      >
        <div
          className={`pointer-events-none absolute top-1 left-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm transition-opacity duration-200 select-none ${img.isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          style={{ zIndex: Z_INDEX_LABEL }}
        >
          {Math.round(img.offsetX)}, {Math.round(img.offsetY)}
        </div>
        <Image
          src={img.url}
          alt=""
          draggable={false}
          width={img.naturalWidth}
          height={img.naturalHeight}
          unoptimized // Важно для blob: URL
          className="absolute max-w-none origin-top-left select-none"
          style={{
            left: 0,
            top: 0,
            transform: `translate3d(${img.offsetX}px, ${img.offsetY}px, 0)`,
            width: img.naturalWidth,
            height: img.naturalHeight,
            backfaceVisibility: 'hidden',
            imageRendering: 'inherit',
          }}
        />
      </div>
    );
  }
);
DraggableImageSlot.displayName = 'DraggableImageSlot';

// --- MAIN COMPONENT ---
export function VerticalImageAligner() {
  const [images, setImages] = useState<AlignImage[]>([]);
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Dimensions
  const [slotHeight, setSlotHeight] = useState(DEFAULT_SETTINGS.slotSize);
  const [slotWidth, setSlotWidth] = useState(DEFAULT_SETTINGS.slotSize);

  // Grids & Settings
  const [showFrameGrid, setShowFrameGrid] = useState(true);
  const [frameStepX, setFrameStepX] = useState(DEFAULT_SETTINGS.frameStep);
  const [frameBorderColor] = useState(DEFAULT_SETTINGS.frameColor);

  const [showRedGrid, setShowRedGrid] = useState(true);
  const [redGridOffsetX, setRedGridOffsetX] = useState(0);
  const [redGridOffsetY, setRedGridOffsetY] = useState(0);
  const [redGridColor] = useState(DEFAULT_SETTINGS.redGridColor);

  const [draggingListIndex, setDraggingListIndex] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const workspaceRef = useRef<CanvasRef>(null);

  const activeImageId = useMemo(() => images.find((img) => img.isActive)?.id ?? null, [images]);

  // REFACTOR: Использование безопасной утилиты очистки
  useEffect(() => () => imagesRef.current.forEach((img) => revokeObjectURLSafely(img.url)), []);

  const { bounds, totalHeight } = useMemo(() => {
    if (!images.length) return { bounds: { width: 1, height: 1 }, totalHeight: 0 };
    const width = slotWidth;
    const height = Math.max(1, images.length * slotHeight);
    return { bounds: { width, height }, totalHeight: height };
  }, [images.length, slotHeight, slotWidth]);

  // --- Handlers ---
  const getCanvasScale = useCallback(
    () => workspaceRef.current?.getTransform().scale || CANVAS_SCALE_DEFAULT,
    []
  );

  const handleUpdatePosition = useCallback((id: string, x: number, y: number) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, offsetX: x, offsetY: y } : img))
    );
  }, []);

  const handleCenterAllX = useCallback(
    () =>
      setImages((prev) =>
        prev.map((img) => ({ ...img, offsetX: Math.round((slotWidth - img.naturalWidth) / 2) }))
      ),
    [slotWidth]
  );

  const handleCenterAllY = useCallback(
    () =>
      setImages((prev) =>
        prev.map((img) => ({ ...img, offsetY: Math.round((slotHeight - img.naturalHeight) / 2) }))
      ),
    [slotHeight]
  );

  const handleActivate = useCallback(
    (id: string) => setImages((prev) => prev.map((x) => ({ ...x, isActive: x.id === id }))),
    []
  );

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) revokeObjectURLSafely(target.url);
      return prev.filter((img) => img.id !== id);
    });
  }, []);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggingListIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggingListIndex === null || draggingListIndex === targetIndex) {
      setDraggingListIndex(null);
      return;
    }
    setImages((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(draggingListIndex, 1);
      copy.splice(targetIndex, 0, item);
      return copy;
    });
    setDraggingListIndex(null);
  };

  const processFiles = useCallback(
    (files: File[]) => {
      if (!files || files.length === 0) return;
      const newImages: AlignImage[] = [];
      const isListEmpty = images.length === 0;

      [...files].forEach((file, index) => {
        if (!file.type.startsWith('image/')) return;
        const url = URL.createObjectURL(file);
        const id = `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`;
        newImages.push({
          id,
          file,
          url,
          name: file.name,
          offsetX: 0,
          offsetY: 0,
          isActive: isListEmpty && index === 0,
          naturalWidth: 0,
          naturalHeight: 0,
        });
      });

      setImages((prev) => [...prev, ...newImages]);

      newImages.forEach(async (item, idx) => {
        try {
          const img = await loadImage(item.url);

          if (isListEmpty && idx === 0) {
            setSlotHeight(img.height);
            setFrameStepX(img.height);

            try {
              const tempCanvas = document.createElement('canvas');
              tempCanvas.width = 1;
              tempCanvas.height = 1;
              const tempCtx = tempCanvas.getContext('2d');
              if (tempCtx) {
                tempCtx.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
                const [r, g, b] = tempCtx.getImageData(0, 0, 1, 1).data;
                const hex = rgbToHex(r, g, b);
                workspaceRef.current?.setBackgroundColor(hex);
              }
            } catch (e) {
              console.warn('Could not extract color from image', e);
            }

            setTimeout(() => {
              workspaceRef.current?.resetView(img.width, img.height);
            }, VIEW_RESET_DELAY);
          }

          setSlotWidth((prev) => {
            if (isListEmpty && idx === 0) return img.width;
            return Math.max(prev, img.width);
          });

          setImages((current) =>
            current.map((ex) =>
              ex.id === item.id ? { ...ex, naturalWidth: img.width, naturalHeight: img.height } : ex
            )
          );
        } catch (e) {
          console.error(e);
        }
      });
    },
    [images.length]
  );

  const handleExport = useCallback(async () => {
    if (!images.length) return;
    setIsExporting(true);
    try {
      const loaded = await Promise.all(
        images.map(async (item) => {
          const img = await loadImage(item.url);
          return { meta: item, img };
        })
      );

      const finalW = slotWidth;
      const finalH = images.length * slotHeight;
      const canvas = document.createElement('canvas');
      canvas.width = finalW;
      canvas.height = finalH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const currentBg = workspaceRef.current?.getBackgroundColor();

      if (currentBg) {
        ctx.fillStyle = currentBg;
        ctx.fillRect(0, 0, finalW, finalH);
      } else {
        ctx.clearRect(0, 0, finalW, finalH);
      }

      loaded.forEach(({ meta, img }, index) => {
        const slotY = index * slotHeight;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, slotY, slotWidth, slotHeight);
        ctx.clip();
        ctx.drawImage(img, meta.offsetX, slotY + meta.offsetY, img.width, img.height);
        ctx.restore();
      });

      downloadDataUrl(canvas.toDataURL('image/png'), EXPORT_FILENAME);
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setIsExporting(false);
    }
  }, [images, slotHeight, slotWidth]);

  const sidebarContent = (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-2">
        <FileDropzone onFilesSelected={processFiles} multiple={true} label="Добавить изображения" />
      </div>

      {images.length > 0 && (
        <>
          <div className="space-y-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className={`w-full rounded-md bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md disabled:opacity-50`}
            >
              {isExporting ? 'Экспорт...' : 'Скачать PNG'}
            </button>
          </div>

          <ControlSection title="Размеры слота">
            <div className="flex flex-col gap-6">
              <TextureDimensionSlider
                label="Ширина"
                value={slotWidth}
                onChange={setSlotWidth}
                max={LIMIT_MAX_BROWSER}
              />
              <TextureDimensionSlider
                label="Высота"
                value={slotHeight}
                onChange={setSlotHeight}
                max={LIMIT_MAX_BROWSER}
              />
            </div>

            <div className="mt-4 flex justify-between border-t border-zinc-200 pt-3 text-center text-xs font-medium text-zinc-500 dark:border-zinc-700">
              <span>Итого:</span>
              <span className="font-mono text-zinc-900 dark:text-zinc-100">
                {slotWidth} x {totalHeight} px
              </span>
            </div>
          </ControlSection>

          <ControlSection title="Зеленая сетка (Кадр)">
            <Switch checked={showFrameGrid} onCheckedChange={setShowFrameGrid} label="Отображать" />
            {showFrameGrid && (
              <div className="mt-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                <Slider
                  label="Шаг X"
                  value={frameStepX}
                  onChange={setFrameStepX}
                  max={slotWidth * 2}
                  statusColor="green"
                />
              </div>
            )}
          </ControlSection>

          <ControlSection title="Красная сетка (Сдвиг)">
            <Switch checked={showRedGrid} onCheckedChange={setShowRedGrid} label="Отображать" />
            {showRedGrid && (
              <div className="mt-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                <Slider
                  label="Сдвиг X"
                  value={redGridOffsetX}
                  onChange={setRedGridOffsetX}
                  min={-slotWidth}
                  max={slotWidth}
                  statusColor="red"
                />
                <Slider
                  label="Сдвиг Y"
                  value={redGridOffsetY}
                  onChange={setRedGridOffsetY}
                  min={-slotHeight}
                  max={slotHeight}
                  statusColor="red"
                />
              </div>
            )}
          </ControlSection>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1 pb-1">
              <ControlLabel>Слои</ControlLabel>
              <div className="flex gap-2">
                <button
                  onClick={handleCenterAllX}
                  className="rounded p-1 font-mono text-xs font-bold text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700"
                >
                  |X|
                </button>
                <button
                  onClick={handleCenterAllY}
                  className="rounded p-1 font-mono text-xs font-bold text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700"
                >
                  ≡Y≡
                </button>
              </div>
            </div>
            {images.map((img, i) => (
              <div
                key={img.id}
                draggable
                onDragStart={(e) => handleDragStart(e, i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, i)}
                className={`flex cursor-pointer items-center gap-3 rounded-md border p-2.5 text-sm transition-colors select-none ${img.isActive ? 'border-blue-200 bg-blue-50 text-blue-800 shadow-sm dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-100' : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800'}`}
                onClick={() => handleActivate(img.id)}
              >
                <span className="w-6 font-mono text-zinc-400">#{i + 1}</span>
                <span className="flex-1 truncate font-medium">{img.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage(img.id);
                  }}
                  className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {activeImageId && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
              <p className="mb-3 text-xs font-bold tracking-wide text-yellow-800 uppercase dark:text-yellow-200">
                Смещение активного слоя
              </p>
              <Slider
                label="X (px)"
                value={Math.round(images.find((i) => i.id === activeImageId)?.offsetX || 0)}
                onChange={(val) =>
                  handleUpdatePosition(
                    activeImageId,
                    val,
                    images.find((i) => i.id === activeImageId)?.offsetY || 0
                  )
                }
                min={-slotWidth}
                max={slotWidth}
                statusColor="yellow"
              />
              <Slider
                label="Y (px)"
                value={Math.round(images.find((i) => i.id === activeImageId)?.offsetY || 0)}
                onChange={(val) =>
                  handleUpdatePosition(
                    activeImageId,
                    images.find((i) => i.id === activeImageId)?.offsetX || 0,
                    val
                  )
                }
                min={-slotHeight}
                max={slotHeight}
                statusColor="yellow"
              />
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
        defaultBackgroundColor={DEFAULT_SETTINGS.bgColor}
        placeholder={
          !images.length ? (
            <FileDropzonePlaceholder
              onUpload={processFiles}
              multiple={true}
              title="Перетащите изображения для склейки"
            />
          ) : null
        }
      >
        {showRedGrid && (
          <div
            className={`pointer-events-none absolute inset-0 opacity-50`}
            style={{
              zIndex: Z_INDEX_GRID_RED,
              backgroundImage: `linear-gradient(to right, ${redGridColor} 1px, transparent 1px), linear-gradient(to bottom, ${redGridColor} 1px, transparent 1px)`,
              backgroundSize: `${frameStepX}px ${slotHeight}px`,
              backgroundPosition: `${redGridOffsetX}px ${redGridOffsetY}px`,
            }}
          />
        )}
        {showFrameGrid && (
          <div
            className={`pointer-events-none absolute inset-0 opacity-80`}
            style={{
              zIndex: Z_INDEX_GRID_FRAME,
              backgroundImage: `linear-gradient(to right, ${frameBorderColor} ${GRID_FRAME_DASH}px, transparent ${GRID_FRAME_DASH}px), linear-gradient(to bottom, ${frameBorderColor} ${GRID_FRAME_DASH}px, transparent ${GRID_FRAME_DASH}px)`,
              backgroundSize: `${frameStepX}px ${slotHeight}px`,
              backgroundPosition: GRID_FRAME_OFFSET_CSS,
            }}
          />
        )}
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
      </Canvas>
    </ToolLayout>
  );
}
