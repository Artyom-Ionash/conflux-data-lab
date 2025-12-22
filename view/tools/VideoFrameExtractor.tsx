'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { generateSpriteSheet } from '@/lib/modules/graphics/processing/sprite-generator';
import { TEXTURE_LIMITS } from '@/lib/modules/graphics/standards';
import { useFrameExtractor } from '@/lib/modules/video/use-frame-extractor';
import { Card } from '@/view/ui/Card';
import { MultiScalePreview } from '@/view/ui/collections/MultiScalePreview';
import { SpriteFrameList } from '@/view/ui/collections/SpriteFrameList';
import { ColorInput } from '@/view/ui/ColorInput';
import { ControlLabel, ControlSection } from '@/view/ui/ControlSection';
import { DownloadButton } from '@/view/ui/DownloadButton';
import { EngineRoom } from '@/view/ui/EngineRoom';
import { FileDropzone, FileDropzonePlaceholder } from '@/view/ui/FileDropzone';
import { ImageSequencePlayer } from '@/view/ui/ImageSequencePlayer';
import { InfoBadge } from '@/view/ui/InfoBadge';
import { getAspectRatio, getAspectRatioStyle } from '@/view/ui/infrastructure/standards';
import { Group, Stack } from '@/view/ui/Layout';
import { Modal } from '@/view/ui/Modal';
import { NumberStepper } from '@/view/ui/NumberStepper';
import { DualHoverPreview } from '@/view/ui/players/DualHoverPreview';
import { RangeVideoPlayer } from '@/view/ui/players/RangeVideoPlayer';
import { ProgressBar } from '@/view/ui/ProcessingOverlay';
import { RangeSlider } from '@/view/ui/RangeSlider';
import { Separator } from '@/view/ui/Separator';
import { Switch } from '@/view/ui/Switch';
import { Workbench } from '@/view/ui/Workbench';

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
      const y = h - margin - fontSize;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillText(timeText, x + 2, y + 2);

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
      const a = document.createElement('a');
      a.href = url;
      a.download = 'spritesheet.png';
      a.click();
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

  const aspectRatioStyle = useMemo(
    () => getAspectRatioStyle(state.videoDimensions?.width, state.videoDimensions?.height),
    [state.videoDimensions]
  );

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
            {/* [LEMON] Layout Transformation */}
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
                  <InfoBadge label="Range">
                    <span>{state.extractionParams.startTime.toFixed(2)}s</span>
                    <span className="mx-1 opacity-50">→</span>
                    <span>{state.effectiveEnd.toFixed(2)}s</span>
                  </InfoBadge>
                </Group>

                <div
                  ref={sliderContainerRef}
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
                      aspectRatioStyle={aspectRatioStyle}
                    />
                  )}
                </div>
                {state.error && (
                  <div className="text-right text-xs font-medium text-red-600">{state.error}</div>
                )}
              </Stack>
            </Card>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card
                className="flex flex-col overflow-hidden shadow-sm"
                title={<ControlLabel>Исходное видео</ControlLabel>}
                contentClassName="p-0"
              >
                <div className="relative w-full bg-black" style={aspectRatioStyle}>
                  <RangeVideoPlayer
                    src={state.videoSrc}
                    startTime={state.extractionParams.startTime}
                    endTime={state.effectiveEnd}
                    className="absolute inset-0"
                  />
                </div>
              </Card>

              <Card
                className="flex flex-col overflow-hidden shadow-sm"
                title={<ControlLabel>Разница</ControlLabel>}
                headerActions={
                  diffDataUrl ? (
                    <DownloadButton
                      onDownload={() => {
                        const a = document.createElement('a');
                        a.href = diffDataUrl;
                        a.download = 'diff.png';
                        a.click();
                      }}
                      variant="link"
                    />
                  ) : undefined
                }
                contentClassName="p-0"
              >
                <div
                  className="relative w-full bg-zinc-100 dark:bg-zinc-950"
                  style={aspectRatioStyle}
                >
                  <div className="absolute inset-0">
                    <FrameDiffOverlay
                      image1={previewFrames.start}
                      image2={previewFrames.end}
                      isProcessing={isPreviewing}
                      onDataGenerated={setDiffDataUrl}
                    />
                  </div>
                </div>
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
                      disabled={true}
                    />
                  </Group>
                }
                headerActions={
                  state.frames.length > 0 && !state.status.isProcessing ? (
                    <DownloadButton
                      onDownload={actions.generateAndDownloadGif}
                      variant="link"
                      label={
                        state.status.currentStep === 'generating' ? 'Кодирование...' : 'Скачать GIF'
                      }
                      disabled={state.status.isProcessing}
                    />
                  ) : undefined
                }
                contentClassName="p-0"
              >
                <div
                  className="group relative w-full cursor-pointer bg-zinc-100 dark:bg-zinc-950"
                  style={aspectRatioStyle}
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
                      <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
                        <div className="scale-95 transform rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:scale-100 group-hover:opacity-100">
                          Открыть масштабы ⤢
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
                      Нет кадров
                    </div>
                  )}
                </div>
              </Card>
            </div>

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
                      disabled={true}
                    />
                    <div className="w-48 pt-1">
                      <TextureLimitIndicator value={totalSpriteWidth} label="ШИРИНА" />
                    </div>
                    <DownloadButton
                      onDownload={handleDownloadSpriteSheet}
                      variant="link"
                      label="Скачать PNG"
                      disabled={totalSpriteWidth > MAX_BROWSER_TEXTURE}
                    />
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
                    className="gap-2 text-xs font-medium whitespace-nowrap"
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
                  <ColorInput
                    value={spriteOptions.bg === 'transparent' ? null : spriteOptions.bg}
                    onChange={(v) => setSpriteOptions((p) => ({ ...p, bg: v }))}
                    allowTransparent
                    onClear={() => setSpriteOptions((p) => ({ ...p, bg: 'transparent' }))}
                  />
                </Group>
              )}
              <div className="custom-scrollbar overflow-x-auto bg-zinc-100 p-4 dark:bg-zinc-950">
                <SpriteFrameList
                  frames={state.frames}
                  maxHeight={spriteOptions.maxHeight}
                  spacing={spriteOptions.spacing}
                  backgroundColor={spriteOptions.bg}
                  videoAspectRatio={videoRatio}
                />
              </div>
            </ControlSection>
          </Workbench.Content>
        )}

        <EngineRoom>
          <video ref={refs.videoRef} crossOrigin="anonymous" muted playsInline />
          <video ref={refs.previewVideoRef} crossOrigin="anonymous" muted playsInline />
          <video ref={refs.hoverVideoRef} crossOrigin="anonymous" muted playsInline />
          <canvas ref={refs.canvasRef} />
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
