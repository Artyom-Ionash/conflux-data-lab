'use client';
import React, { useMemo, useState } from 'react';

import { downloadDataUrl } from '@/core/browser/canvas';
import { getAspectRatio } from '@/core/primitives/math';
import { useAsyncDerived } from '@/core/react/hooks/use-async-derived';
import { generateSpriteSheet } from '@/lib/graphics/processing/sprite-generator';
import { TEXTURE_LIMITS } from '@/lib/graphics/standards';
import { ProgressBar } from '@/ui/atoms/feedback/ProgressBar';
import { NumberStepper } from '@/ui/atoms/input/NumberStepper';
import { Switch } from '@/ui/atoms/input/Switch';
import { EngineRoom } from '@/ui/atoms/layout/EngineRoom';
import { Group, Stack } from '@/ui/atoms/layout/Layout';
import { Surface } from '@/ui/atoms/layout/Surface';
import { Separator } from '@/ui/atoms/primitive/Separator';
import { Modal } from '@/ui/molecules/container/Modal';
import { Section } from '@/ui/molecules/container/Section';
import { Button } from '@/ui/molecules/input/Button';
import { ColorInput } from '@/ui/molecules/input/ColorInput';
import { Workbench } from '@/ui/molecules/layout/Workbench';
import { MultiScalePreview } from '@/ui/molecules/media/MultiScalePreview';
import { SpriteGrid } from '@/ui/molecules/media/SpriteGrid';

import { TextureLimitIndicator } from './_hardware/TextureLimitIndicator';
import { FileDropzone, FileDropzonePlaceholder } from './_io/FileDropzone';
import { MonitorDashboard } from './_video/MonitorDashboard';
import { TimelineControl } from './_video/TimelineControl';
import { useFrameExtractor } from './_video/use-frame-extractor';

const MAX_BROWSER_TEXTURE = TEXTURE_LIMITS.MAX_BROWSER;

// --- DOM Helpers ---
const setVideoTime = (video: HTMLVideoElement, time: number) => {
  video.currentTime = time;
};

const setCanvasSize = (canvas: HTMLCanvasElement, width: number, height: number) => {
  canvas.width = width;
  canvas.height = height;
};

export function VideoFrameExtractor() {
  const { refs, state, actions } = useFrameExtractor();

  // FIX: Деструктурируем refs, чтобы избежать ошибки линтера "Cannot access refs during render"
  // Линтер триггерится на точечную нотацию refs.someRef внутри JSX.
  const { videoRef, previewVideoRef, hoverVideoRef, canvasRef } = refs;

  // --- Local UI State ---
  const [spriteOptions, setSpriteOptions] = useState({
    maxHeight: 300,
    spacing: 0,
    bg: 'transparent',
  });
  const [diffDataUrl, setDiffDataUrl] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- PIPELINE: Preview Generation ---

  // Объект input должен быть стабильным по ссылке
  // (useMemo для предотвращения бесконечного цикла ре-рендеров).
  const previewInput = useMemo(() => {
    if (!state.videoSrc) return null;
    return {
      src: state.videoSrc, // Используем как ключ для перезапуска, но не для мутации
      start: Math.max(0, state.extractionParams.startTime),
      end: Math.min(state.effectiveEnd, state.videoDuration ?? 0),
    };
  }, [state.videoSrc, state.extractionParams.startTime, state.effectiveEnd, state.videoDuration]);

  const previewPipeline = useAsyncDerived(
    previewInput,
    async (input, signal) => {
      // Используем ref.current внутри эффекта - это легально
      const vid = previewVideoRef.current;
      const canvas = canvasRef.current;

      if (!vid || !canvas) throw new Error('DOM elements not ready');

      // АРХИТЕКТУРНОЕ ИСПРАВЛЕНИЕ:
      // Мы не устанавливаем vid.src вручную. Это делает React в JSX (декларативно).
      // Здесь мы просто ждём, когда браузер подхватит изменения и загрузит метаданные.

      // Ждем готовности (Metadata Wait)
      // Если видео ещё не загрузило метаданные (readyState < 1) или если мы только что сменили src,
      // нам нужно подождать события.
      if (vid.readyState < 1 || vid.src !== input.src) {
        // Если React ещё не успел обновить DOM (редкий кейс, но возможный в микротасках),
        // или если браузер начал загрузку.
        await new Promise<void>((resolve, reject) => {
          // Если src уже верный и данные есть — сразу резолвим
          if (vid.src === input.src && vid.readyState >= 1) {
            resolve();
            return;
          }

          const onLoaded = () => resolve();
          const onError = (e: Event) => reject(e);

          vid.addEventListener('loadedmetadata', onLoaded, { once: true });
          vid.addEventListener('error', onError, { once: true });

          // Если отмена пришла во время ожидания
          signal.addEventListener('abort', () => {
            vid.removeEventListener('loadedmetadata', onLoaded);
            vid.removeEventListener('error', onError);
            reject(new Error('Aborted'));
          });
        });
      }

      // Resize Canvas (через хелпер)
      setCanvasSize(canvas, vid.videoWidth, vid.videoHeight);

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context failed');

      // Helper for seeking and capturing
      const capture = async (time: number) => {
        if (signal.aborted) throw new Error('Aborted');

        // Seek (через хелпер)
        setVideoTime(vid, time);

        await new Promise<void>((resolve) => {
          const onSeek = () => resolve();
          vid.addEventListener('seeked', onSeek, { once: true });
        });

        ctx.drawImage(vid, 0, 0);
        return canvas.toDataURL('image/png');
      };

      // Capture Sequence
      const startUrl = await capture(input.start);
      const endUrl = await capture(input.end);

      return { start: startUrl, end: endUrl };
    },
    500 // Debounce 500ms
  );

  const previewFrames = previewPipeline.result ?? { start: null, end: null };
  const isPreviewing = previewPipeline.status === 'loading';

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
          <FileDropzonePlaceholder
            onUpload={actions.handleFilesSelected}
            multiple={false}
            accept="video/*"
            title="Загрузите видеофайл"
            subTitle="Поддерживаются MP4, WEBM, MOV"
          />
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
              hoverVideoRef={hoverVideoRef}
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
            <Section
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
                    checked={state.symmetricLoop}
                    onCheckedChange={(c) => actions.setSymmetricLoop(c)}
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
                <SpriteGrid
                  frames={state.frames}
                  maxHeight={spriteOptions.maxHeight}
                  spacing={spriteOptions.spacing}
                  backgroundColor={spriteOptions.bg}
                  videoAspectRatio={videoRatio || 1.77}
                />
              </Stack>
            </Section>
          </Workbench.Content>
        )}

        <EngineRoom>
          <Surface.Video ref={videoRef} />

          {/* ДЕКЛАРАТИВНАЯ ПРИВЯЗКА SRC */}
          <Surface.Video ref={previewVideoRef} src={state.videoSrc || undefined} />

          <Surface.Video ref={hoverVideoRef} />
          <Surface.Canvas ref={canvasRef} />
        </EngineRoom>

        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Предпросмотр масштабов"
          className="h-[92vh] w-[96vw] max-w-[1920px]"
        >
          <MultiScalePreview
            frames={state.frames.map((f) => f?.dataUrl ?? null)}
            fps={state.gifParams.fps}
          />
        </Modal>
      </Workbench.Stage>
    </Workbench.Root>
  );
}
