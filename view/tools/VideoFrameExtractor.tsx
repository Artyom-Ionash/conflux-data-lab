'use client';
import React, { useEffect, useMemo, useState } from 'react';

import { downloadDataUrl } from '@/core/browser/canvas';
import { getAspectRatio } from '@/core/primitives/math';
import { generateSpriteSheet } from '@/lib/graphics/processing/sprite-generator';
import { TEXTURE_LIMITS } from '@/lib/graphics/standards';
import { Modal } from '@/view/ui/container/Modal';
import { ProgressBar } from '@/view/ui/feedback/ProgressBar';
import { Button } from '@/view/ui/input/Button';
import { ColorInput } from '@/view/ui/input/ColorInput';
import { NumberStepper } from '@/view/ui/input/NumberStepper';
import { Switch } from '@/view/ui/input/Switch';
import { EngineRoom } from '@/view/ui/layout/EngineRoom';
import { Group, Stack } from '@/view/ui/layout/Layout';
import { Surface } from '@/view/ui/layout/Surface';
import { Workbench } from '@/view/ui/layout/Workbench';
import { MultiScalePreview } from '@/view/ui/media/MultiScalePreview';
import { Separator } from '@/view/ui/primitive/Separator';

import { SpriteFrameList } from './_graphics/SpriteFrameList';
import { TextureLimitIndicator } from './_hardware/TextureLimitIndicator';
import { ControlSection } from './_io/ControlSection';
import { FileDropzone, FileDropzonePlaceholder } from './_io/FileDropzone';
import { MonitorDashboard } from './_video/MonitorDashboard';
import { TimelineControl } from './_video/TimelineControl';
import { useFrameExtractor } from './_video/use-frame-extractor';

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

  // Preview Logic State
  const [previewFrames, setPreviewFrames] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  });
  const [isPreviewing, setIsPreviewing] = useState(false);

  // --- Preview Generation Effect ---
  // Это логика "Сущности", она остается здесь или выносится в хук (TODO: Refactor to hook)
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

  const videoRatio = useMemo(
    () => getAspectRatio(state.videoDimensions?.width, state.videoDimensions?.height),
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
            <ProgressBar value={state.status.progress} label="Обработка..." />
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
            {/* 1. Controls Area */}
            <TimelineControl
              startTime={state.extractionParams.startTime}
              effectiveEnd={state.effectiveEnd}
              endTime={state.extractionParams.endTime}
              duration={state.videoDuration}
              frameStep={state.extractionParams.frameStep}
              videoSrc={state.videoSrc}
              videoDimensions={state.videoDimensions}
              hoverVideoRef={refs.hoverVideoRef as React.RefObject<HTMLVideoElement>}
              previewStart={previewFrames.start}
              previewEnd={previewFrames.end}
              error={state.error}
              onTimeChange={(start, end) =>
                actions.setExtractionParams((p) => ({ ...p, startTime: start, endTime: end }))
              }
              onStepChange={(step) =>
                actions.setExtractionParams((p) => ({ ...p, frameStep: step }))
              }
            />

            {/* 2. Monitoring Grid */}
            <MonitorDashboard
              videoSrc={state.videoSrc}
              startTime={state.extractionParams.startTime}
              endTime={state.effectiveEnd}
              videoDimensions={state.videoDimensions}
              previewStart={previewFrames.start}
              previewEnd={previewFrames.end}
              diffDataUrl={diffDataUrl}
              isDiffProcessing={isPreviewing}
              frames={state.frames}
              gifFps={state.gifParams.fps}
              captureFps={captureFps}
              isProcessing={state.status.isProcessing}
              onDiffGenerated={setDiffDataUrl}
              onGifFpsChange={(fps) => actions.setGifParams((p) => ({ ...p, fps }))}
              onDownloadGif={actions.generateAndDownloadGif}
              onOpenScaleModal={() => setIsModalOpen(true)}
            />

            {/* 3. Output Configuration */}
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
                  videoAspectRatio={videoRatio || 1.77}
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
