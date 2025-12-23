'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useCopyToClipboard } from '@/lib/core/hooks/use-copy-to-clipboard'; // Добавил для полноты, хотя тут не используется
import { downloadDataUrl } from '@/lib/core/utils/media';
import { generateSpriteSheet } from '@/lib/modules/graphics/processing/sprite-generator';
import { TEXTURE_LIMITS } from '@/lib/modules/graphics/standards';
import { useFrameExtractor } from '@/lib/modules/video/use-frame-extractor';
import { FileDropzone, FileDropzonePlaceholder } from '@/view/tools/io/FileDropzone';
import { Button } from '@/view/ui/Button';
import { Card } from '@/view/ui/Card';
import { MultiScalePreview } from '@/view/ui/collections/MultiScalePreview';
import { ColorInput } from '@/view/ui/ColorInput';
import { ControlLabel, ControlSection } from '@/view/ui/ControlSection';
import { EngineRoom } from '@/view/ui/EngineRoom';
import { ImageSequencePlayer } from '@/view/ui/ImageSequencePlayer';
import { Indicator } from '@/view/ui/Indicator';
import { getAspectRatio, getAspectRatioStyle } from '@/view/ui/infrastructure/standards';
import { Columns, Group, Stack } from '@/view/ui/Layout';
import { Modal } from '@/view/ui/Modal';
import { NumberStepper } from '@/view/ui/NumberStepper';
import { OverlayLabel } from '@/view/ui/OverlayLabel';
import { DualHoverPreview } from '@/view/ui/players/DualHoverPreview';
import { RangeVideoPlayer } from '@/view/ui/players/RangeVideoPlayer';
import { ProgressBar } from '@/view/ui/ProcessingOverlay';
import { RangeSlider } from '@/view/ui/RangeSlider';
import { Separator } from '@/view/ui/Separator';
import { Surface } from '@/view/ui/Surface';
import { Switch } from '@/view/ui/Switch';
import { Typography } from '@/view/ui/Typography';
import { Workbench } from '@/view/ui/Workbench';

import { SpriteFrameList } from './graphics/SpriteFrameList';
// --- DOMAIN IMPORTS ---
import { TextureLimitIndicator } from './hardware/TextureLimitIndicator';
import { FrameDiffOverlay } from './video/FrameDiffOverlay';

const DEFAULT_ASPECT_RATIO = 1.77;
const MAX_BROWSER_TEXTURE = TEXTURE_LIMITS.MAX_BROWSER;

export function VideoFrameExtractor() {
  const { refs, state, actions } = useFrameExtractor();

  // --- Local UI State ---
  const [spriteOptions, setSpriteOptions] = useState({
    maxHeight: 300,
    spacing: 0,
    bg: 'transparent',
  });
  const [diffDataUrl, setDiffDataUrl] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [previewFrames, setPreviewFrames] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  });
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [hoverPreview, setHoverPreview] = useState<{ activeThumb: 0 | 1; time: number } | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);

  const sliderContainerRef = useRef<HTMLDivElement>(null);

  // --- Preview Generation Effect ---
  useEffect(() => {
    const vid = refs.previewVideoRef.current;
    const canvas = refs.canvasRef.current;
    const src = state.videoSrc;

    if (!src || !vid || !canvas || !state.videoDuration) return;
    if (state.status.isProcessing) return;

    if (vid.src !== src) vid.src = src;
    const ctx = canvas.getContext('2d');

    const timer = setTimeout(async () => {
      setIsPreviewing(true);
      try {
        if (vid.readyState < 1)
          await new Promise<void>((r) => {
            vid.onloadedmetadata = () => r();
          });

        canvas.width = vid.videoWidth;
        canvas.height = vid.videoHeight;

        const safeStart = Math.max(0, state.extractionParams.startTime);

        // Start Frame
        vid.currentTime = safeStart;
        await new Promise<void>((r) => {
          vid.onseeked = () => r();
        });
        ctx?.drawImage(vid, 0, 0);
        const startUrl = canvas.toDataURL('image/png');

        // End Frame
        vid.currentTime = Math.min(state.effectiveEnd, state.videoDuration ?? 0);
        await new Promise<void>((r) => {
          vid.onseeked = () => r();
        });
        ctx?.drawImage(vid, 0, 0);
        const endUrl = canvas.toDataURL('image/png');

        setPreviewFrames({ start: startUrl, end: endUrl });
      } catch (e) {
        console.error('Preview failed', e);
      } finally {
        setIsPreviewing(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [
    state.videoSrc,
    state.extractionParams.startTime,
    state.effectiveEnd,
    state.videoDuration,
    state.status.isProcessing,
    refs.previewVideoRef,
    refs.canvasRef,
  ]);

  // --- Helpers ---
  const handleDrawOverlay = useCallback(
    (ctx: CanvasRenderingContext2D, index: number, w: number, h: number) => {
      const frame = state.frames[index];
      if (!frame) return;
      const timeText = `${frame.time.toFixed(2)}s`;
      const fontSize = Math.max(14, Math.floor(w * 0.05));
      ctx.font = `bold ${fontSize}px monospace`;

      const margin = Math.max(8, w * 0.03);
      const x = margin;
      const y = h - margin;

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(timeText, x, y);

      ctx.fillStyle = 'white';
      ctx.fillText(timeText, x, y);
    },
    [state.frames]
  );

  const handleDownloadSpriteSheet = async () => {
    if (state.frames.length === 0) return;
    try {
      const url = await generateSpriteSheet(state.frames, {
        maxHeight: spriteOptions.maxHeight,
        spacing: spriteOptions.spacing,
        backgroundColor: spriteOptions.bg,
      });
      downloadDataUrl(url, 'spritesheet.png');
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Ошибка генерации');
    }
  };

  const handleSliderHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!state.videoDuration || isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const time = percentage * state.videoDuration;

    const distToStart = Math.abs(time - state.extractionParams.startTime);
    const distToEnd = Math.abs(time - state.effectiveEnd);
    const nearestThumb = distToStart < distToEnd ? 0 : 1;

    setHoverPreview({ activeThumb: nearestThumb, time });
    if (refs.hoverVideoRef.current) refs.hoverVideoRef.current.currentTime = time;
  };

  const handleValueChange = (newValues: number[], thumbIndex?: 0 | 1) => {
    const start = newValues[0] ?? 0;
    const end = newValues[1] ?? 0;
    actions.setExtractionParams((p) => ({ ...p, startTime: start, endTime: end }));

    if (isDragging && typeof thumbIndex === 'number') {
      const changedTime = newValues[thumbIndex] ?? 0;
      setHoverPreview({ activeThumb: thumbIndex, time: changedTime });
      if (refs.hoverVideoRef.current) refs.hoverVideoRef.current.currentTime = changedTime;
    }
  };

  // --- Calculations ---

  const videoRatio = useMemo(
    () =>
      getAspectRatio(state.videoDimensions?.width, state.videoDimensions?.height) ||
      DEFAULT_ASPECT_RATIO,
    [state.videoDimensions]
  );

  const totalSpriteWidth = useMemo(() => {
    if (!state.videoDimensions || state.frames.length === 0) return 0;
    const scale = spriteOptions.maxHeight / state.videoDimensions.height;
    const scaledWidth = Math.floor(state.videoDimensions.width * scale);
    return (scaledWidth + spriteOptions.spacing) * state.frames.length - spriteOptions.spacing;
  }, [state.videoDimensions, state.frames.length, spriteOptions.maxHeight, spriteOptions.spacing]);

  const captureFps =
    state.extractionParams.frameStep > 0 ? Math.round(1 / state.extractionParams.frameStep) : 10;

  const currentSpeedPercent = Math.round((state.gifParams.fps / captureFps) * 100);

  // --- RENDER ---

  const sidebarContent = (
    <Stack gap={6}>
      <Workbench.Header title="Видео в Кадры/GIF" />

      <Stack gap={2}>
        <FileDropzone
          onFilesSelected={actions.handleFilesSelected}
          multiple={false}
          accept="video/*"
          label="Загрузить видео"
        />
        {state.status.isProcessing && (
          <Stack
            gap={0}
            className="rounded border border-blue-100 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"
          >
            <ProgressBar progress={state.status.progress} label="Обработка..." />
          </Stack>
        )}
      </Stack>
    </Stack>
  );

  return (
    <Workbench.Root>
      <Workbench.Sidebar>{sidebarContent}</Workbench.Sidebar>
      <Workbench.Stage>
        {!state.videoSrc ? (
          <Workbench.EmptyStage>
            <FileDropzonePlaceholder
              onUpload={actions.handleFilesSelected}
              multiple={false}
              accept="video/*"
              title="Перетащите видеофайл"
            />
          </Workbench.EmptyStage>
        ) : (
          <Workbench.Content>
            {/* Layout Transformation */}
            <Card className="relative z-20 overflow-visible shadow-sm" contentClassName="p-4">
              <Stack gap={4}>
                <Group justify="between" wrap>
                  <Group gap={6}>
                    <ControlLabel>Диапазон</ControlLabel>
                    <Separator />
                    <NumberStepper
                      label="Шаг (сек)"
                      value={state.extractionParams.frameStep}
                      onChange={(v) => actions.setExtractionParams((p) => ({ ...p, frameStep: v }))}
                      step={0.05}
                      min={0.05}
                      max={10}
                    />
                  </Group>
                  <Indicator label="Range">
                    {state.extractionParams.startTime.toFixed(2)}s
                    <span className="mx-1 opacity-50">→</span>
                    {state.effectiveEnd.toFixed(2)}s
                  </Indicator>
                </Group>

                <Stack
                  ref={sliderContainerRef}
                  gap={0}
                  className="group relative touch-none py-2"
                  onMouseMove={handleSliderHover}
                  onMouseLeave={() => !isDragging && setHoverPreview(null)}
                  onPointerDown={() => setIsDragging(true)}
                  onPointerUp={() => {
                    setIsDragging(false);
                    setHoverPreview(null);
                  }}
                >
                  <RangeSlider
                    min={0}
                    max={state.videoDuration ?? 0}
                    step={0.01}
                    value={[state.extractionParams.startTime, state.effectiveEnd]}
                    onValueChange={handleValueChange}
                    minStepsBetweenThumbs={0.1}
                  />
                  {hoverPreview && (
                    <DualHoverPreview
                      activeThumb={hoverPreview.activeThumb}
                      hoverTime={hoverPreview.time}
                      startTime={state.extractionParams.startTime}
                      endTime={state.effectiveEnd}
                      videoSrc={state.videoSrc}
                      videoRef={refs.hoverVideoRef as React.RefObject<HTMLVideoElement>}
                      previewStartImage={previewFrames.start}
                      previewEndImage={previewFrames.end}
                      aspectRatioStyle={getAspectRatioStyle(
                        state.videoDimensions?.width,
                        state.videoDimensions?.height
                      )}
                    />
                  )}
                </Stack>
                {state.error && (
                  <Typography.Text variant="error" align="right">
                    {state.error}
                  </Typography.Text>
                )}
              </Stack>
            </Card>

            <Columns desktop={3} gap={4}>
              <Card
                className="flex flex-col overflow-hidden shadow-sm"
                title={<ControlLabel>Исходное видео</ControlLabel>}
                contentClassName="p-0"
              >
                <Stack className="relative w-full bg-black" style={getAspectRatioStyle(videoRatio)}>
                  <RangeVideoPlayer
                    src={state.videoSrc}
                    startTime={state.extractionParams.startTime}
                    endTime={state.effectiveEnd}
                    className="absolute inset-0"
                  />
                </Stack>
              </Card>

              <Card
                className="flex flex-col overflow-hidden shadow-sm"
                title={<ControlLabel>Разница</ControlLabel>}
                headerActions={
                  diffDataUrl ? (
                    <Button
                      onClick={() => downloadDataUrl(diffDataUrl ?? '', 'diff.png')}
                      variant="link"
                      size="xs"
                    >
                      Скачать
                    </Button>
                  ) : undefined
                }
                contentClassName="p-0"
              >
                <Stack
                  className="relative w-full bg-zinc-100 dark:bg-zinc-950"
                  style={getAspectRatioStyle(videoRatio)}
                >
                  <FrameDiffOverlay
                    image1={previewFrames.start}
                    image2={previewFrames.end}
                    isProcessing={isPreviewing}
                    onDataGenerated={setDiffDataUrl}
                  />
                </Stack>
              </Card>

              <Card
                className="flex flex-col overflow-hidden shadow-sm"
                title={
                  <Group gap={4}>
                    <ControlLabel>Спрайт</ControlLabel>
                    <NumberStepper
                      label="Скорость %"
                      value={currentSpeedPercent}
                      onChange={(val) => {
                        const newFps = Math.max(1, Math.round(captureFps * (val / 100)));
                        actions.setGifParams((p) => ({ ...p, fps: newFps }));
                      }}
                      min={10}
                      max={500}
                      step={10}
                    />
                    <NumberStepper
                      label="FPS"
                      value={state.gifParams.fps}
                      onChange={() => {}}
                      disabled
                    />
                  </Group>
                }
                headerActions={
                  state.frames.length > 0 && !state.status.isProcessing ? (
                    <Button
                      onClick={actions.generateAndDownloadGif}
                      variant="link"
                      size="xs"
                      disabled={state.status.isProcessing}
                    >
                      {state.status.currentStep === 'generating' ? 'Кодирование...' : 'Скачать GIF'}
                    </Button>
                  ) : undefined
                }
                contentClassName="p-0"
              >
                <Stack
                  className="group relative w-full cursor-pointer bg-zinc-100 dark:bg-zinc-950"
                  style={getAspectRatioStyle(videoRatio)}
                  onClick={() => setIsModalOpen(true)}
                >
                  {state.frames.length > 0 || state.status.isProcessing ? (
                    <>
                      <ImageSequencePlayer
                        images={state.frames.map((f) => f.dataUrl)}
                        fps={state.gifParams.fps}
                        width={state.videoDimensions?.width || 300}
                        height={state.videoDimensions?.height || 200}
                        onDrawOverlay={handleDrawOverlay}
                      />
                      <OverlayLabel
                        position="bottom-right"
                        className="opacity-0 group-hover:opacity-100"
                      >
                        Масштабы ⤢
                      </OverlayLabel>
                    </>
                  ) : (
                    <Typography.Text variant="dimmed" align="center" className="py-20">
                      Нет кадров
                    </Typography.Text>
                  )}
                </Stack>
              </Card>
            </Columns>

            <ControlSection
              title="Спрайт-лист"
              className="shadow-sm"
              headerRight={
                state.frames.length > 0 && (
                  <Group gap={4}>
                    <NumberStepper
                      label="Кадров"
                      value={state.frames.length}
                      onChange={() => {}}
                      disabled
                    />
                    <Stack gap={0} className="w-48">
                      <TextureLimitIndicator value={totalSpriteWidth} label="ШИРИНА" />
                    </Stack>
                    <Button
                      onClick={handleDownloadSpriteSheet}
                      variant="link"
                      size="xs"
                      disabled={totalSpriteWidth > MAX_BROWSER_TEXTURE}
                    >
                      Скачать PNG
                    </Button>
                  </Group>
                )
              }
            >
              {state.frames.length > 0 && (
                <Group gap={4} wrap>
                  <Switch
                    label="Loop"
                    checked={state.extractionParams.symmetricLoop}
                    onCheckedChange={(c) =>
                      actions.setExtractionParams((p) => ({ ...p, symmetricLoop: c }))
                    }
                  />
                  <Separator />
                  <NumberStepper
                    label="Высота"
                    value={spriteOptions.maxHeight}
                    onChange={(v) => setSpriteOptions((p) => ({ ...p, maxHeight: v }))}
                    step={10}
                    min={10}
                    max={2000}
                  />
                  <Separator />
                  <NumberStepper
                    label="Отступ"
                    value={spriteOptions.spacing}
                    onChange={(v) => setSpriteOptions((p) => ({ ...p, spacing: v }))}
                    step={1}
                    min={0}
                    max={100}
                  />
                  <Separator />
                  <ColorInput
                    value={spriteOptions.bg === 'transparent' ? null : spriteOptions.bg}
                    onChange={(v) => setSpriteOptions((p) => ({ ...p, bg: v }))}
                    allowTransparent
                    onClear={() => setSpriteOptions((p) => ({ ...p, bg: 'transparent' }))}
                  />
                </Group>
              )}
              <Stack className="custom-scrollbar overflow-x-auto rounded-lg bg-zinc-100 p-4 dark:bg-zinc-950">
                <SpriteFrameList
                  frames={state.frames}
                  maxHeight={spriteOptions.maxHeight}
                  spacing={spriteOptions.spacing}
                  backgroundColor={spriteOptions.bg}
                  videoAspectRatio={videoRatio}
                />
              </Stack>
            </ControlSection>
          </Workbench.Content>
        )}

        <EngineRoom>
          <Surface.Video ref={refs.videoRef} />
          <Surface.Video ref={refs.previewVideoRef} />
          <Surface.Video ref={refs.hoverVideoRef} />
          <Surface.Canvas ref={refs.canvasRef} />
        </EngineRoom>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Предпросмотр масштабов"
          className="h-[92vh] w-[96vw] max-w-[1920px]"
        >
          <MultiScalePreview
            frames={state.frames.map((f) => f.dataUrl)}
            fps={state.gifParams.fps}
          />
        </Modal>
      </Workbench.Stage>
    </Workbench.Root>
  );
}
