'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { filter, map, pipe } from 'remeda';

import { rgbToHex } from '@/lib/core/utils/colors';
import { getTopLeftPixelColor, loadImage, revokeObjectURLSafely } from '@/lib/core/utils/media';
import {
  bakeVerticalStack,
  calculateCenterOffset,
  type CompositionLayer,
} from '@/lib/modules/graphics/processing/composition';
import { WorkbenchCanvas } from '@/view/tools/graphics/WorkbenchCanvas';
import { TextureDimensionSlider } from '@/view/tools/hardware/TextureDimensionSlider';
import { CanvasMovable, useCanvasRef } from '@/view/ui/Canvas';
import { ControlLabel, ControlSection } from '@/view/ui/ControlSection';
import { DownloadButton } from '@/view/ui/DownloadButton';
import { FileDropzone, FileDropzonePlaceholder } from '@/view/ui/FileDropzone';
import { cn } from '@/view/ui/infrastructure/standards';
import { SortableList } from '@/view/ui/interaction/SortableList';
import { Slider } from '@/view/ui/Slider';
import { Switch } from '@/view/ui/Switch';
import { Workbench } from '@/view/ui/Workbench';

const LIMIT_MAX_BROWSER = 16_384;
const VIEW_RESET_DELAY = 50;
const EXPORT_FILENAME = 'aligned-export.png';
const GRID_FRAME_DASH = 10;
const GRID_FRAME_OFFSET_CSS = '-5px -5px';
const Z_INDEX_SLOT_BASE = 10;
const Z_INDEX_SLOT_ACTIVE = 30;
const Z_INDEX_GRID_RED = 50;
const Z_INDEX_GRID_FRAME = 60;

const DEFAULT_SETTINGS = {
  slotSize: 1,
  frameStep: 1,
  frameColor: '#00ff00',
  redGridColor: '#ff0000',
  bgColor: '#ffffff',
};

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

export function VerticalImageAligner() {
  const [images, setImages] = useState<AlignImage[]>([]);
  const imagesRef = useRef(images);

  // Sync ref for cleanup
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  // Clean up object URLs on unmount
  useEffect(() => () => imagesRef.current.forEach((img) => revokeObjectURLSafely(img.url)), []);

  const [slotHeight, setSlotHeight] = useState(DEFAULT_SETTINGS.slotSize);
  const [slotWidth, setSlotWidth] = useState(DEFAULT_SETTINGS.slotSize);
  const [showFrameGrid, setShowFrameGrid] = useState(true);
  const [frameStepX, setFrameStepX] = useState(DEFAULT_SETTINGS.frameStep);
  const [frameBorderColor] = useState(DEFAULT_SETTINGS.frameColor);
  const [showRedGrid, setShowRedGrid] = useState(true);
  const [redGridOffsetX, setRedGridOffsetX] = useState(0);
  const [redGridOffsetY, setRedGridOffsetY] = useState(0);
  const [redGridColor] = useState(DEFAULT_SETTINGS.redGridColor);
  const [isExporting, setIsExporting] = useState(false);

  const { ref: workspaceRef, getScale } = useCanvasRef();

  const activeImageId = useMemo(() => images.find((img) => img.isActive)?.id ?? null, [images]);

  const { bounds, totalHeight } = useMemo(() => {
    if (images.length === 0) return { bounds: { width: 1, height: 1 }, totalHeight: 0 };
    const width = slotWidth;
    const height = images.length * slotHeight;
    return { bounds: { width, height }, totalHeight: height };
  }, [images.length, slotHeight, slotWidth]);

  // --- Handlers ---

  const handleUpdatePosition = useCallback((id: string, pos: { x: number; y: number }) => {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, offsetX: pos.x, offsetY: pos.y } : img))
    );
  }, []);

  const handleCenterAllX = useCallback(
    () =>
      setImages((prev) =>
        prev.map((img) => ({
          ...img,
          offsetX: calculateCenterOffset(img.naturalWidth, slotWidth),
        }))
      ),
    [slotWidth]
  );

  const handleCenterAllY = useCallback(
    () =>
      setImages((prev) =>
        prev.map((img) => ({
          ...img,
          offsetY: calculateCenterOffset(img.naturalHeight, slotHeight),
        }))
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

  const processFiles = useCallback(
    (files: File[]) => {
      if (!files || files.length === 0) return;
      const isListEmpty = images.length === 0;

      const newImages = pipe(
        files,
        filter((f) => f.type.startsWith('image/')),
        map((file, index) => ({
          id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 11)}`,
          file,
          url: URL.createObjectURL(file),
          name: file.name,
          offsetX: 0,
          offsetY: 0,
          isActive: isListEmpty && index === 0,
          naturalWidth: 0,
          naturalHeight: 0,
        }))
      );

      if (newImages.length === 0) return;

      setImages((prev) => [...prev, ...newImages]);

      newImages.forEach(async (item, idx) => {
        try {
          const img = await loadImage(item.url);

          if (isListEmpty && idx === 0) {
            setSlotHeight(img.height);
            setFrameStepX(img.height);
            const { r, g, b } = getTopLeftPixelColor(img);
            workspaceRef.current?.setBackgroundColor(rgbToHex(r, g, b));
            setTimeout(() => {
              workspaceRef.current?.resetView(img.width, img.height);
            }, VIEW_RESET_DELAY);
          }

          setSlotWidth((prev) =>
            isListEmpty && idx === 0 ? img.width : Math.max(prev, img.width)
          );

          setImages((current) =>
            current.map((ex) =>
              ex.id === item.id ? { ...ex, naturalWidth: img.width, naturalHeight: img.height } : ex
            )
          );
        } catch (e) {
          console.error('Failed to load image metadata', e);
        }
      });
    },
    [images.length, workspaceRef]
  );

  const handleExport = useCallback(async () => {
    if (images.length === 0) return;
    setIsExporting(true);

    const compositionLayers: CompositionLayer[] = images.map((img) => ({
      url: img.url,
      x: img.offsetX,
      y: img.offsetY,
      width: img.naturalWidth,
      height: img.naturalHeight,
    }));

    try {
      await bakeVerticalStack({
        layers: compositionLayers,
        canvasWidth: slotWidth,
        canvasHeight: totalHeight,
        slotHeight,
        backgroundColor: workspaceRef.current?.getBackgroundColor() || null,
        filename: EXPORT_FILENAME,
      });
    } catch (e) {
      console.error('Export failed', e);
    } finally {
      setIsExporting(false);
    }
  }, [images, slotHeight, slotWidth, totalHeight, workspaceRef]);

  // --- Render Props ---

  const renderSortableItem = (
    img: AlignImage,
    index: number,
    isDragging: boolean,
    dragProps: React.HTMLAttributes<HTMLDivElement>
  ) => (
    <div
      {...dragProps}
      className={cn(
        'flex cursor-grab items-center gap-3 rounded-md border p-2.5 text-sm transition-colors select-none active:cursor-grabbing',
        img.isActive
          ? 'border-blue-200 bg-blue-50 text-blue-800 shadow-sm dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-100'
          : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800',
        isDragging && 'opacity-50'
      )}
      onClick={() => handleActivate(img.id)}
    >
      <span className="w-6 font-mono text-zinc-400">#{index + 1}</span>
      <span className="flex-1 truncate font-medium">{img.name}</span>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          handleRemoveImage(img.id);
        }}
        className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
      >
        ✕
      </button>
    </div>
  );

  const sidebarContent = (
    <div className="flex flex-col gap-6 pb-4">
      <div>
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>{' '}
          На главную
        </Link>
        <h2 className="text-xl font-bold">Вертикальный склейщик</h2>
      </div>

      <div className="flex flex-col gap-2">
        <FileDropzone onFilesSelected={processFiles} multiple={true} label="Добавить изображения" />
      </div>

      {images.length > 0 && (
        <>
          <div className="space-y-2">
            <DownloadButton
              onDownload={handleExport}
              disabled={isExporting}
              label={isExporting ? 'Экспорт...' : 'Скачать PNG'}
              className="w-full"
            />
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

          <ControlSection title="Сетки">
            <div className="flex flex-col gap-4">
              <div className="space-y-3">
                <Switch
                  checked={showFrameGrid}
                  onCheckedChange={setShowFrameGrid}
                  label="Зеленая (Кадр)"
                  className="w-full"
                />
                {showFrameGrid && (
                  <Slider
                    label=""
                    value={frameStepX}
                    onChange={setFrameStepX}
                    max={slotWidth * 2}
                    statusColor="green"
                    className="mb-0 px-1"
                  />
                )}
              </div>

              <div className="space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                <Switch
                  checked={showRedGrid}
                  onCheckedChange={setShowRedGrid}
                  label="Красная (Сдвиг)"
                  className="w-full"
                />
                {showRedGrid && (
                  <div className="space-y-4 px-1 pt-1">
                    <Slider
                      label="Сдвиг X"
                      value={redGridOffsetX}
                      onChange={setRedGridOffsetX}
                      min={-slotWidth}
                      max={slotWidth}
                      statusColor="red"
                      className="mb-0"
                    />
                    <Slider
                      label="Сдвиг Y"
                      value={redGridOffsetY}
                      onChange={setRedGridOffsetY}
                      min={-slotHeight}
                      max={slotHeight}
                      statusColor="red"
                      className="mb-0"
                    />
                  </div>
                )}
              </div>
            </div>
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

            <SortableList
              items={images}
              onReorder={setImages}
              renderItem={renderSortableItem}
              className="max-h-[300px] overflow-y-auto pr-1"
            />
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
                  handleUpdatePosition(activeImageId, {
                    x: val,
                    y: images.find((i) => i.id === activeImageId)?.offsetY || 0,
                  })
                }
                min={-slotWidth}
                max={slotWidth}
                statusColor="yellow"
              />
              <Slider
                label="Y (px)"
                value={Math.round(images.find((i) => i.id === activeImageId)?.offsetY || 0)}
                onChange={(val) =>
                  handleUpdatePosition(activeImageId, {
                    x: images.find((i) => i.id === activeImageId)?.offsetX || 0,
                    y: val,
                  })
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
    <Workbench.Root>
      <Workbench.Sidebar>{sidebarContent}</Workbench.Sidebar>
      <Workbench.Stage>
        <WorkbenchCanvas
          ref={workspaceRef}
          isLoading={isExporting}
          contentWidth={bounds.width}
          contentHeight={bounds.height}
          shadowOverlayOpacity={images.length > 0 ? 0.5 : 0}
          showTransparencyGrid={true}
          defaultBackgroundColor={DEFAULT_SETTINGS.bgColor}
          placeholder={
            images.length === 0 ? (
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
              className="pointer-events-none absolute inset-0 opacity-50"
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
              className="pointer-events-none absolute inset-0 opacity-80"
              style={{
                zIndex: Z_INDEX_GRID_FRAME,
                backgroundImage: `linear-gradient(to right, ${frameBorderColor} ${GRID_FRAME_DASH}px, transparent ${GRID_FRAME_DASH}px), linear-gradient(to bottom, ${frameBorderColor} ${GRID_FRAME_DASH}px, transparent ${GRID_FRAME_DASH}px)`,
                backgroundSize: `${frameStepX}px ${slotHeight}px`,
                backgroundPosition: GRID_FRAME_OFFSET_CSS,
              }}
            />
          )}

          {images.map((img, i) => (
            <div
              key={img.id}
              className="pointer-events-none absolute left-0 overflow-hidden border-r border-dashed border-zinc-300/30 transition-colors"
              style={{
                top: i * slotHeight,
                height: slotHeight,
                width: slotWidth,
                zIndex: img.isActive ? Z_INDEX_SLOT_ACTIVE : Z_INDEX_SLOT_BASE,
              }}
            >
              <CanvasMovable
                x={img.offsetX}
                y={img.offsetY}
                scale={getScale} // Pass getter from hook
                onMove={(pos) =>
                  handleUpdatePosition(img.id, { x: Math.round(pos.x), y: Math.round(pos.y) })
                }
                onDragStart={() => handleActivate(img.id)}
                className={cn('pointer-events-auto', img.isActive && 'ring-1 ring-blue-500')}
              >
                {() => (
                  <>
                    <Image
                      src={img.url}
                      alt=""
                      draggable={false}
                      width={img.naturalWidth}
                      height={img.naturalHeight}
                      unoptimized
                      className="max-w-none origin-top-left select-none"
                      style={{
                        width: img.naturalWidth,
                        height: img.naturalHeight,
                        imageRendering: 'inherit',
                      }}
                    />
                    <div
                      className={cn(
                        'pointer-events-none absolute top-1 left-1 z-50 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm transition-opacity duration-200 select-none',
                        img.isActive ? 'opacity-100' : 'opacity-0'
                      )}
                    >
                      {Math.round(img.offsetX)}, {Math.round(img.offsetY)}
                    </div>
                  </>
                )}
              </CanvasMovable>
            </div>
          ))}
        </WorkbenchCanvas>
      </Workbench.Stage>
    </Workbench.Root>
  );
}
