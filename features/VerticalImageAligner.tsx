'use client';

import Image from 'next/image';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { filter, map, pipe } from 'remeda';

import { getTopLeftPixelColor, loadImage, revokeObjectURLSafely } from '@/core/browser/canvas';
import { rgbToHex } from '@/core/primitives/colors';
import {
  bakeVerticalStack,
  calculateCenterOffset,
  type CompositionLayer,
} from '@/lib/graphics/processing/composition';
import { CanvasMovable, useCanvasRef } from '@/ui/canvas/Canvas';
import { CanvasLayer } from '@/ui/canvas/CanvasLayer';
import { GridOverlay } from '@/ui/canvas/GridOverlay';
import { SortableList } from '@/ui/canvas/SortableList';
import { WorkbenchFrame } from '@/ui/canvas/WorkbenchFrame';
import { ActionGroup } from '@/ui/container/ActionGroup';
import { Card } from '@/ui/container/Card';
import { Section, SectionHeader } from '@/ui/container/Section';
import { StatusBox } from '@/ui/container/StatusBox';
import { Button } from '@/ui/input/Button';
import { Slider } from '@/ui/input/Slider';
import { Switch } from '@/ui/input/Switch';
import { Group, Stack } from '@/ui/layout/Layout';
import { Workbench } from '@/ui/layout/Workbench';
import { Icon } from '@/ui/primitive/Icon';
import { Indicator } from '@/ui/primitive/Indicator';
import { OverlayLabel } from '@/ui/primitive/OverlayLabel';
import { Typography } from '@/ui/primitive/Typography';

import { TextureDimensionSlider } from './_hardware/TextureDimensionSlider';
import { FileDropzonePlaceholder } from './_io/FileDropzone';
import { SidebarIO } from './_io/SidebarIO';

const LIMIT_MAX_BROWSER = 16_384;
const VIEW_RESET_DELAY = 50;
const EXPORT_FILENAME = 'aligned-export.png';
const GRID_FRAME_DASH = 10;

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
  const [showRedGrid, setShowRedGrid] = useState(true);
  const [redGridOffsetX, setRedGridOffsetX] = useState(0);
  const [redGridOffsetY, setRedGridOffsetY] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [bgColor, setBgColor] = useState(DEFAULT_SETTINGS.bgColor);

  const { ref: workspaceRef, getScale } = useCanvasRef();

  const activeImageId = useMemo(() => images.find((img) => img.isActive)?.id ?? null, [images]);

  const { bounds, totalHeight } = useMemo(() => {
    if (images.length === 0) return { bounds: { width: 1, height: 1 }, totalHeight: 0 };
    const width = slotWidth;
    const height = images.length * slotHeight;
    return { bounds: { width, height }, totalHeight: height };
  }, [images.length, slotHeight, slotWidth]);

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
            setBgColor(rgbToHex(r, g, b));

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

  const renderSortableItem = (
    img: AlignImage,
    index: number,
    isDragging: boolean,
    dragProps: React.HTMLAttributes<HTMLElement>
  ) => (
    <Card
      {...dragProps}
      variant="default"
      active={img.isActive}
      className={`cursor-grab select-none active:cursor-grabbing ${isDragging ? 'opacity-50' : ''}`}
      onClick={() => handleActivate(img.id)}
      contentClassName="p-2.5 flex items-center gap-3"
    >
      <Typography.Text variant="dimmed" className="w-6 shrink-0 font-mono text-xs">
        #{index + 1}
      </Typography.Text>
      <Typography.Text className="min-w-0 flex-1 truncate font-medium">{img.name}</Typography.Text>
      <Button
        variant="destructive"
        size="xs"
        className="h-6 w-6 shrink-0 p-0"
        title="Удалить"
        onClick={(e) => {
          e.stopPropagation();
          handleRemoveImage(img.id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Icon.Trash className="h-3.5 w-3.5" />
      </Button>
    </Card>
  );

  const sidebarContent = (
    <Stack gap={6}>
      <Workbench.Header title="Вертикальный склейщик" />

      <SidebarIO
        onFilesSelected={processFiles}
        multiple
        accept="image/*"
        dropLabel="Добавить изображения"
        hasFiles={images.length > 0}
        onDownload={handleExport}
        isDownloading={isExporting}
      />

      {images.length > 0 && (
        <>
          <Section title="Размеры слота">
            <Stack gap={6}>
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
            </Stack>

            <Group
              justify="between"
              className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-700"
            >
              <Typography.Text variant="secondary" className="font-medium">
                Итого:
              </Typography.Text>
              <Indicator>
                {slotWidth} x {totalHeight} px
              </Indicator>
            </Group>
          </Section>

          <Section title="Сетки">
            <Stack gap={4}>
              <Stack gap={3}>
                <Switch
                  checked={showFrameGrid}
                  onCheckedChange={setShowFrameGrid}
                  label="Зеленая (Кадр)"
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
              </Stack>

              <Stack gap={3} className="border-t border-zinc-200 pt-3 dark:border-zinc-700">
                <Switch
                  checked={showRedGrid}
                  onCheckedChange={setShowRedGrid}
                  label="Красная (Сдвиг)"
                />
                {showRedGrid && (
                  <Stack gap={4} className="px-1 pt-1">
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
                  </Stack>
                )}
              </Stack>
            </Stack>
          </Section>

          <Stack gap={1.5}>
            <SectionHeader
              title="Слои"
              actions={
                <ActionGroup attached>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handleCenterAllX}
                    title="Центрировать по горизонтали"
                    className="rounded-r-none font-mono text-[10px]"
                  >
                    |X|
                  </Button>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={handleCenterAllY}
                    title="Центрировать по вертикали"
                    className="rounded-l-none border-l border-zinc-300 font-mono text-[10px] dark:border-zinc-700"
                  >
                    ≡Y≡
                  </Button>
                </ActionGroup>
              }
            />

            <SortableList
              items={images}
              onReorder={setImages}
              renderItem={renderSortableItem}
              className="max-h-[300px] overflow-y-auto pr-1"
            />
          </Stack>

          {activeImageId && (
            <StatusBox variant="warning" title="Смещение активного слоя">
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
            </StatusBox>
          )}
        </>
      )}
    </Stack>
  );

  return (
    <Workbench.Root>
      <Workbench.Sidebar>{sidebarContent}</Workbench.Sidebar>
      <Workbench.Stage>
        {images.length === 0 ? (
          <FileDropzonePlaceholder
            onUpload={processFiles}
            multiple={true}
            title="Перетащите сюда изображения"
            subTitle="Ряды кадров"
          />
        ) : (
          <WorkbenchFrame
            ref={workspaceRef}
            isLoading={isExporting}
            contentWidth={bounds.width}
            contentHeight={bounds.height}
            shadowOverlayOpacity={0.5}
            showTransparencyGrid={true}
            defaultBackgroundColor={bgColor}
          >
            {/* 
              1. Слой изображений (КОНТЕНТ).
              Используем стандартные слои Canvas.
              Это помещает изображения "вглубь", позволяя интерфейсным сеткам быть сверху.
            */}
            {images.map((img, i) => (
              <CanvasLayer
                key={img.id}
                isActive={img.isActive}
                style={{
                  top: i * slotHeight,
                  height: slotHeight,
                  width: slotWidth,
                  // z-canvas-content - для фона
                  // z-canvas-overlay - для активного элемента
                  zIndex: img.isActive ? 'var(--z-canvas-overlay)' : 'var(--z-canvas-content)',
                }}
              >
                <CanvasMovable
                  x={img.offsetX}
                  y={img.offsetY}
                  scale={getScale}
                  onMove={(pos) =>
                    handleUpdatePosition(img.id, { x: Math.round(pos.x), y: Math.round(pos.y) })
                  }
                  onDragStart={() => handleActivate(img.id)}
                  className={
                    img.isActive
                      ? 'pointer-events-auto ring-1 ring-blue-500'
                      : 'pointer-events-auto'
                  }
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
                      <OverlayLabel className={img.isActive ? 'opacity-100' : 'opacity-0'}>
                        {Math.round(img.offsetX)}, {Math.round(img.offsetY)}
                      </OverlayLabel>
                    </>
                  )}
                </CanvasMovable>
              </CanvasLayer>
            ))}

            {/* 
              2. Слой линеек.
              Используем z-canvas-ui, что гарантирует положение ПОВЕРХ любого контента.
              z-[...] необходим, так как GridOverlay имеет инлайн-стиль по умолчанию.
            */}
            {showRedGrid && (
              <GridOverlay
                color="#ff0000"
                stepX={frameStepX}
                stepY={slotHeight}
                offsetX={redGridOffsetX}
                offsetY={redGridOffsetY}
                className="z-(--z-canvas-ui)!"
              />
            )}

            {showFrameGrid && (
              <GridOverlay
                color="#00ff00"
                stepX={frameStepX}
                stepY={slotHeight}
                dash={GRID_FRAME_DASH}
                opacity={0.8}
                className="z-(--z-canvas-ui)!"
              />
            )}
          </WorkbenchFrame>
        )}
      </Workbench.Stage>
    </Workbench.Root>
  );
}
