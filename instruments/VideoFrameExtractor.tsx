'use client';
import type { CreateGIFResult } from 'gifshot';
import gifshot from 'gifshot';
import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDebounceEffect } from '@/lib/core/hooks/use-debounce-effect';
import { useObjectUrl } from '@/lib/core/hooks/use-object-url';
import { waitForVideoFrame } from '@/lib/core/utils/media';
import { cn } from '@/lib/core/utils/styles';
import { generateSpriteSheet } from '@/lib/modules/graphics/processing/sprite-generator';
import { TEXTURE_LIMITS } from '@/lib/modules/graphics/standards';
// --- UI IMPORTS ---
import { Card } from '@/ui/Card';
import { MultiScalePreview } from '@/ui/collections/MultiScalePreview';
import { SpriteFrameList } from '@/ui/collections/SpriteFrameList';
import { ColorInput } from '@/ui/ColorInput';
import { ControlLabel, ControlSection } from '@/ui/ControlSection';
import { FileDropzone, FileDropzonePlaceholder } from '@/ui/FileDropzone';
import { ImageSequencePlayer } from '@/ui/ImageSequencePlayer';
import { Modal } from '@/ui/Modal';
import { NumberStepper } from '@/ui/NumberStepper';
// --- EXTRACTED COMPONENTS ---
import { DualHoverPreview } from '@/ui/players/DualHoverPreview';
import { RangeVideoPlayer } from '@/ui/players/RangeVideoPlayer';
import { RangeSlider } from '@/ui/RangeSlider';
import { Switch } from '@/ui/Switch';
import { Workbench } from '@/ui/Workbench';

// --- DOMAIN IMPORTS ---
import { TextureLimitIndicator } from './entities/hardware/TextureLimitIndicator';
import { FrameDiffOverlay } from './entities/video/FrameDiffOverlay';

// --- CONSTANTS ---
const DEFAULT_CLIP_DURATION = 0.5; // seconds
const DEFAULT_FRAME_STEP = 0.1; // seconds
const DEFAULT_FPS = 10;
const DEFAULT_ASPECT_RATIO = 1.77; // 16:9 approx
const MAX_BROWSER_TEXTURE = TEXTURE_LIMITS.MAX_BROWSER;

// --- TYPES ---
export interface ExtractedFrame {
  time: number;
  dataUrl: string | null;
}

export interface ExtractionParams {
  startTime: number;
  endTime: number;
  frameStep: number;
  symmetricLoop: boolean;
}

// --- LOGIC HOOKS ---

function useVideoFrameExtraction() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoSrc = useObjectUrl(videoFile);

  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(
    null
  );

  const [extractionParams, setExtractionParams] = useState<ExtractionParams>({
    startTime: 0,
    endTime: 0,
    frameStep: 1,
    symmetricLoop: false,
  });
  const [rawFrames, setRawFrames] = useState<ExtractedFrame[]>([]);

  const frames = useMemo(() => {
    if (rawFrames.length < 2) return rawFrames;
    if (!extractionParams.symmetricLoop) return rawFrames;
    const loopBack = rawFrames.slice(1, -1).reverse();
    return [...rawFrames, ...loopBack];
  }, [rawFrames, extractionParams.symmetricLoop]);

  const [gifParams, setGifParams] = useState({ fps: DEFAULT_FPS, dataUrl: null as string | null });
  const [status, setStatus] = useState({ isProcessing: false, currentStep: '', progress: 0 });
  const [error, setError] = useState<string | null>(null);

  const [previewFrames, setPreviewFrames] = useState<{ start: string | null; end: string | null }>({
    start: null,
    end: null,
  });
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const hoverVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const effectiveEnd = useMemo(
    () => (extractionParams.endTime > 0 ? extractionParams.endTime : (videoDuration ?? 0)),
    [extractionParams.endTime, videoDuration]
  );

  // Auto-FPS Logic
  useEffect(() => {
    if (extractionParams.frameStep > 0) {
      const calculatedFps = Math.round(1 / extractionParams.frameStep);
      const safeFps = Math.max(1, Math.min(60, calculatedFps));
      setGifParams((prev) => ({ ...prev, fps: safeFps }));
    }
  }, [extractionParams.frameStep]);

  // Sync Hover Video Source
  useEffect(() => {
    if (hoverVideoRef.current && videoSrc && hoverVideoRef.current.src !== videoSrc) {
      hoverVideoRef.current.src = videoSrc;
    }
  }, [videoSrc]);

  // Generate Start/End Previews (Cache)
  useEffect(() => {
    if (!videoSrc || !previewVideoRef.current || !canvasRef.current || !videoDuration) return;
    if (status.isProcessing) return;

    const vid = previewVideoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (vid.src !== videoSrc) vid.src = videoSrc;

    const timer = setTimeout(async () => {
      setIsPreviewing(true);
      try {
        if (vid.readyState < 1)
          await new Promise<void>((r) => {
            vid.onloadedmetadata = () => r();
          });
        canvas.width = vid.videoWidth;
        canvas.height = vid.videoHeight;

        const safeStart = Math.max(0, extractionParams.startTime);
        const interval = extractionParams.frameStep;
        const steps = Math.floor((Math.min(effectiveEnd, videoDuration) - safeStart) / interval);
        const actualEndTime = safeStart + steps * interval;

        // Generate Start Cache
        vid.currentTime = safeStart;
        await new Promise<void>((r) => {
          vid.onseeked = () => r();
        });
        ctx?.drawImage(vid, 0, 0);
        const startUrl = canvas.toDataURL('image/png');

        // Generate End Cache
        vid.currentTime = actualEndTime;
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
    videoSrc,
    extractionParams.startTime,
    effectiveEnd,
    videoDuration,
    status.isProcessing,
    extractionParams.frameStep,
  ]);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const file = files[0];
    if (!file) return;
    setRawFrames([]);
    setPreviewFrames({ start: null, end: null });
    setError(null);
    setGifParams((p) => ({ ...p, dataUrl: null }));
    setVideoDuration(null);
    setVideoDimensions(null);

    setVideoFile(file);

    const objectUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement('video');
    tempVideo.src = objectUrl;
    tempVideo.onloadedmetadata = () => {
      const duration = tempVideo.duration || 0;
      setVideoDuration(duration);
      setVideoDimensions({ width: tempVideo.videoWidth, height: tempVideo.videoHeight });

      const safeStartTime = Math.max(0, duration - DEFAULT_CLIP_DURATION);
      setExtractionParams({
        startTime: safeStartTime,
        endTime: duration,
        frameStep: DEFAULT_FRAME_STEP,
        symmetricLoop: true,
      });
      URL.revokeObjectURL(objectUrl);
    };
    tempVideo.onerror = () => {
      setError('Ошибка загрузки');
      URL.revokeObjectURL(objectUrl);
    };
  }, []);

  const runExtraction = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !videoSrc) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;
    if (videoEl.src !== videoSrc) videoEl.src = videoSrc;

    setStatus({ isProcessing: true, currentStep: 'extracting', progress: 0 });
    setError(null);
    setRawFrames([]);
    setGifParams((p) => ({ ...p, dataUrl: null }));

    try {
      if (videoEl.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          videoEl.onloadedmetadata = () => resolve();
          videoEl.onerror = () => reject(new Error('Load failed'));
        });
      }

      const duration = videoEl.duration;
      const safeStart = Math.max(0, extractionParams.startTime);
      const interval = extractionParams.frameStep;
      if (interval <= 0) throw new Error('Invalid step');

      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
      const ctx = canvasEl.getContext('2d');
      if (!ctx) throw new Error('No ctx');

      const numberOfSteps = Math.floor((Math.min(effectiveEnd, duration) - safeStart) / interval);

      const initialFrames: ExtractedFrame[] = [];
      for (let i = 0; i <= numberOfSteps; i++) {
        initialFrames.push({ time: safeStart + i * interval, dataUrl: null });
      }
      setRawFrames(initialFrames);

      const totalSteps = numberOfSteps + 1;
      for (let i = 0; i <= numberOfSteps; i++) {
        if (signal.aborted) throw new Error('Aborted');
        const current = safeStart + i * interval;

        // ВАЖНО: Асинхронное ожидание кадра
        await new Promise<void>((resolve, reject) => {
          const onSeeked = async () => {
            try {
              // 1. Ждем реальной готовности текстуры в GPU (фикс прозрачного кадра)
              await waitForVideoFrame(videoEl);

              // 2. Проверяем, не отменили ли задачу во время ожидания
              if (signal.aborted) {
                reject(new Error('Aborted'));
                return;
              }

              // 3. Рисуем
              ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
              const url = canvasEl.toDataURL('image/png');
              setRawFrames((prev) =>
                prev.map((f, idx) => (idx === i ? { ...f, dataUrl: url } : f))
              );
              resolve();
            } catch (e) {
              reject(e);
            }
          };

          // Подписываемся разово на событие seeked
          videoEl.addEventListener('seeked', onSeeked, { once: true });
          videoEl.currentTime = current;
        });

        setStatus((s) => ({ ...s, progress: Math.min(100, ((i + 1) / totalSteps) * 100) }));
        await new Promise((r) => requestAnimationFrame(r));
      }
      setStatus({ isProcessing: false, currentStep: '', progress: 100 });
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== 'Aborted') {
        setError(e.message);
        setStatus({ isProcessing: false, currentStep: '', progress: 0 });
      } else if (!(e instanceof Error)) {
        setError('Error');
        setStatus({ isProcessing: false, currentStep: '', progress: 0 });
      }
    }
  }, [videoSrc, extractionParams.startTime, extractionParams.frameStep, effectiveEnd]);

  useDebounceEffect(
    () => {
      if (videoSrc) {
        void runExtraction();
      }
    },
    [runExtraction, videoSrc],
    600
  );

  const generateAndDownloadGif = useCallback(() => {
    // Type Guard: фильтруем и гарантируем, что dataUrl не null
    const validFrames = frames.filter(
      (f): f is ExtractedFrame & { dataUrl: string } => f.dataUrl !== null
    );

    if (validFrames.length === 0) return;

    setStatus({ isProcessing: true, currentStep: 'generating', progress: 0 });
    setError(null);

    setTimeout(() => {
      if (gifshot !== undefined) {
        gifshot.createGIF(
          {
            images: validFrames.map((f) => f.dataUrl),
            interval: 1 / gifParams.fps,
            gifWidth: videoDimensions?.width || 300,
            gifHeight: videoDimensions?.height || 200,
            numFrames: validFrames.length,
          },
          (obj: CreateGIFResult) => {
            if (!obj.error && obj.image) {
              const a = document.createElement('a');
              a.href = obj.image;
              a.download = 'animation.gif';
              a.click();
              setGifParams((p) => ({ ...p, dataUrl: obj.image ?? null }));
            } else {
              setError(`Error: ${obj.errorCode ?? obj.errorMsg ?? 'unknown'}`);
            }
            setStatus({ isProcessing: false, currentStep: '', progress: 0 });
          }
        );
      }
    }, 50);
  }, [frames, gifParams.fps, videoDimensions]);

  return {
    videoRef,
    previewVideoRef,
    hoverVideoRef,
    canvasRef,
    videoSrc,
    videoDuration,
    videoDimensions,
    extractionParams,
    setExtractionParams,
    frames,
    gifParams,
    setGifParams,
    status,
    error,
    effectiveEnd,
    previewFrames,
    isPreviewing,
    handleFilesSelected,
    runExtraction,
    generateAndDownloadGif,
  };
}

// --- MAIN COMPONENT ---

export function VideoFrameExtractor() {
  const {
    videoRef,
    previewVideoRef,
    hoverVideoRef,
    canvasRef,
    videoSrc,
    videoDuration,
    videoDimensions,
    extractionParams,
    setExtractionParams,
    frames,
    gifParams,
    setGifParams,
    status,
    error,
    effectiveEnd,
    previewFrames,
    isPreviewing,
    handleFilesSelected,
    generateAndDownloadGif,
  } = useVideoFrameExtraction();

  // Local UI State
  const [spriteOptions, setSpriteOptions] = useState({
    maxHeight: 300,
    spacing: 0,
    bg: 'transparent',
  });
  const [diffDataUrl, setDiffDataUrl] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Hover Preview State
  const [hoverPreview, setHoverPreview] = useState<{ activeThumb: 0 | 1; time: number } | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const sliderContainerRef = useRef<HTMLDivElement>(null);

  // Draw overlay for SequencePlayer
  const handleDrawOverlay = useCallback(
    (ctx: CanvasRenderingContext2D, index: number, w: number, h: number) => {
      const frame = frames[index];
      if (!frame) return;
      const timeText = `${frame.time.toFixed(2)}s`;
      const fontSize = Math.max(14, Math.floor(w * 0.05));
      ctx.font = `bold ${fontSize}px monospace`;
      const textMetrics = ctx.measureText(timeText);

      const padX = fontSize * 0.6;
      const padY = fontSize * 0.4;
      const margin = Math.max(8, w * 0.03);
      const x = margin;
      const y = h - margin - (fontSize + padY * 2);
      const boxWidth = textMetrics.width + padX * 2;
      const boxHeight = fontSize + padY * 2;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, boxWidth, boxHeight, fontSize * 0.4);
      } else {
        ctx.rect(x, y, boxWidth, boxHeight);
      }
      ctx.fill();

      ctx.fillStyle = 'white';
      ctx.textBaseline = 'middle';
      ctx.fillText(timeText, x + padX, y + boxHeight / 2);
    },
    [frames]
  );

  const handleDownloadSpriteSheet = async () => {
    if (frames.length === 0) return;
    try {
      // USING NEW ABSTRACTION
      const url = await generateSpriteSheet(frames, {
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

  const aspectRatioStyle = useMemo(() => {
    if (!videoDimensions) return {};
    return { aspectRatio: `${videoDimensions.width} / ${videoDimensions.height}` };
  }, [videoDimensions]);

  const totalSpriteWidth = useMemo(() => {
    if (!videoDimensions || frames.length === 0) return 0;
    const scale = spriteOptions.maxHeight / videoDimensions.height;
    const scaledWidth = Math.floor(videoDimensions.width * scale);
    return (scaledWidth + spriteOptions.spacing) * frames.length - spriteOptions.spacing;
  }, [videoDimensions, frames.length, spriteOptions.maxHeight, spriteOptions.spacing]);

  const videoRatio = videoDimensions
    ? videoDimensions.width / videoDimensions.height
    : DEFAULT_ASPECT_RATIO;

  // --- PREVIEW LOGIC ---

  const handleSliderHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoDuration || isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const time = percentage * videoDuration;

    const distToStart = Math.abs(time - extractionParams.startTime);
    const distToEnd = Math.abs(time - effectiveEnd);
    const nearestThumb = distToStart < distToEnd ? 0 : 1;

    setHoverPreview({ activeThumb: nearestThumb, time });
    if (hoverVideoRef.current) hoverVideoRef.current.currentTime = time;
  };

  const handleValueChange = (newValues: number[], thumbIndex?: 0 | 1) => {
    const start = newValues[0] ?? 0;
    const end = newValues[1] ?? 0;

    setExtractionParams((p) => ({ ...p, startTime: start, endTime: end }));

    if (isDragging && typeof thumbIndex === 'number') {
      const changedTime = newValues[thumbIndex] ?? 0;
      setHoverPreview({ activeThumb: thumbIndex, time: changedTime });
      if (hoverVideoRef.current) hoverVideoRef.current.currentTime = changedTime;
    }
  };

  const sidebarContent = (
    <div className="flex flex-col gap-6 pb-4">
      {/* Navigation Header (Теперь часть контента, а не лейаута) */}
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
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>{' '}
          На главную
        </Link>
        <h2 className="text-xl font-bold">Видео в Кадры/GIF</h2>
      </div>

      <div className="flex flex-col gap-2">
        <FileDropzone
          onFilesSelected={handleFilesSelected}
          multiple={false}
          accept="video/*"
          label="Загрузить видео"
        />
        {status.isProcessing && (
          <div className="mt-2 rounded border border-blue-100 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20">
            <div className="mb-1 flex justify-between text-xs font-semibold text-blue-700 dark:text-blue-300">
              <span>Обработка...</span>
              <span className="font-mono">{Math.round(status.progress)}%</span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-blue-200 dark:bg-blue-800">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${status.progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Workbench.Root>
      <Workbench.Sidebar>{sidebarContent}</Workbench.Sidebar>
      <Workbench.Stage>
        <div className="relative flex h-full w-full flex-col overflow-hidden bg-zinc-50 dark:bg-black/20">
          {!videoSrc ? (
            <div className="flex-1 p-8">
              <FileDropzonePlaceholder
                onUpload={handleFilesSelected}
                multiple={false}
                accept="video/*"
                title="Перетащите видеофайл"
              />
            </div>
          ) : (
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {/* CONTROLS CARD */}
              <Card className="relative z-20 overflow-visible shadow-sm" contentClassName="p-4">
                {/* ... Содержимое карточки ... (без изменений) */}
                <div className="flex flex-col gap-4">
                  <div className="space-y-4">
                    {/* Top Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                      <div className="flex flex-wrap items-center gap-6">
                        <ControlLabel>Диапазон</ControlLabel>
                        <div className="hidden h-6 w-px bg-zinc-200 sm:block dark:bg-zinc-700"></div>
                        <NumberStepper
                          label="Шаг (сек)"
                          value={extractionParams.frameStep}
                          onChange={(v) => setExtractionParams((p) => ({ ...p, frameStep: v }))}
                          step={0.05}
                          min={0.05}
                          max={10}
                        />
                      </div>
                      <div className="ml-auto flex items-center gap-2 rounded bg-black/80 px-3 py-1.5 font-mono text-xs font-bold text-white shadow-sm">
                        <span>{extractionParams.startTime.toFixed(2)}s</span>
                        <span className="opacity-50">→</span>
                        <span>{effectiveEnd.toFixed(2)}s</span>
                      </div>
                    </div>

                    {/* Range Slider */}
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
                        max={videoDuration ?? 0}
                        step={0.01}
                        value={[extractionParams.startTime, effectiveEnd]}
                        onValueChange={handleValueChange}
                        minStepsBetweenThumbs={0.1}
                      />

                      {hoverPreview && (
                        <DualHoverPreview
                          activeThumb={hoverPreview.activeThumb}
                          hoverTime={hoverPreview.time}
                          startTime={extractionParams.startTime}
                          endTime={effectiveEnd}
                          videoSrc={videoSrc}
                          videoRef={hoverVideoRef as React.RefObject<HTMLVideoElement>}
                          previewStartImage={previewFrames.start}
                          previewEndImage={previewFrames.end}
                          aspectRatioStyle={aspectRatioStyle}
                        />
                      )}
                    </div>
                  </div>
                  {error && <div className="text-right text-xs text-red-600">{error}</div>}
                </div>
              </Card>

              {/* PREVIEW GRID */}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {/* ... Содержимое грида ... (без изменений) */}
                <Card
                  className="flex flex-col overflow-hidden shadow-sm"
                  title={<ControlLabel>Исходное видео</ControlLabel>}
                  contentClassName="p-0"
                >
                  <div className="relative w-full bg-black" style={aspectRatioStyle}>
                    <RangeVideoPlayer
                      src={videoSrc}
                      startTime={extractionParams.startTime}
                      endTime={effectiveEnd}
                      className="absolute inset-0"
                    />
                  </div>
                </Card>

                {/* 2. Diff Overlay */}
                <Card
                  className="flex flex-col overflow-hidden shadow-sm"
                  title={<ControlLabel>Разница</ControlLabel>}
                  headerActions={
                    diffDataUrl ? (
                      <button
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = diffDataUrl;
                          a.download = 'diff.png';
                          a.click();
                        }}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Скачать
                      </button>
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

                {/* 3. Sprite / GIF Player */}
                <Card
                  className="flex flex-col overflow-hidden shadow-sm"
                  title={
                    <div className="flex items-center gap-4">
                      <ControlLabel>Спрайт</ControlLabel>
                      <NumberStepper
                        label="Скорость %"
                        value={Math.round(
                          (gifParams.fps /
                            (extractionParams.frameStep > 0
                              ? Math.round(1 / extractionParams.frameStep)
                              : 10)) *
                            100
                        )}
                        onChange={(val) => {
                          const base =
                            extractionParams.frameStep > 0
                              ? Math.round(1 / extractionParams.frameStep)
                              : 10;
                          setGifParams((p) => ({
                            ...p,
                            fps: Math.max(1, Math.round(base * (val / 100))),
                          }));
                        }}
                        min={10}
                        max={500}
                        step={10}
                      />
                      <NumberStepper
                        label="FPS"
                        value={gifParams.fps}
                        onChange={() => {}}
                        disabled={true}
                      />
                    </div>
                  }
                  headerActions={
                    frames.length > 0 && !status.isProcessing ? (
                      <button
                        onClick={generateAndDownloadGif}
                        disabled={status.isProcessing}
                        className={cn(
                          'text-xs font-medium text-blue-600 hover:underline disabled:opacity-50',
                          status.isProcessing && 'cursor-not-allowed opacity-50'
                        )}
                      >
                        {status.currentStep === 'generating' ? 'Кодирование...' : 'Скачать GIF'}
                      </button>
                    ) : undefined
                  }
                  contentClassName="p-0"
                >
                  <div
                    className="group relative w-full cursor-pointer bg-zinc-100 dark:bg-zinc-950"
                    style={aspectRatioStyle}
                    onClick={() => setIsModalOpen(true)}
                    title="Нажмите, чтобы открыть предпросмотр масштабов"
                  >
                    {frames.length > 0 || status.isProcessing ? (
                      <>
                        <ImageSequencePlayer
                          images={frames.map((f) => f.dataUrl)}
                          fps={gifParams.fps}
                          width={videoDimensions?.width || 300}
                          height={videoDimensions?.height || 200}
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

              {/* SPRITE SHEET SETTINGS & LIST */}
              <ControlSection
                title="Спрайт-лист"
                className="shadow-sm"
                headerRight={
                  frames.length > 0 && (
                    <div className="flex items-center gap-4">
                      <NumberStepper
                        label="Кадров"
                        value={frames.length}
                        onChange={() => {}}
                        disabled={true}
                      />
                      <div className="w-48 pt-1">
                        <TextureLimitIndicator value={totalSpriteWidth} label="ШИРИНА" />
                      </div>
                      <button
                        onClick={handleDownloadSpriteSheet}
                        className={cn(
                          'text-xs font-bold transition-colors',
                          totalSpriteWidth > MAX_BROWSER_TEXTURE
                            ? 'cursor-not-allowed text-zinc-400'
                            : 'text-blue-600 hover:underline'
                        )}
                        disabled={totalSpriteWidth > MAX_BROWSER_TEXTURE}
                      >
                        Скачать PNG
                      </button>
                    </div>
                  )
                }
              >
                {frames.length > 0 && (
                  <div className="mb-4 flex items-center gap-4">
                    <Switch
                      label="Loop"
                      checked={extractionParams.symmetricLoop}
                      onCheckedChange={(c) =>
                        setExtractionParams((p) => ({ ...p, symmetricLoop: c }))
                      }
                      className="gap-2 text-xs font-medium whitespace-nowrap"
                    />
                    <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700"></div>

                    <NumberStepper
                      label="Высота"
                      value={spriteOptions.maxHeight}
                      onChange={(v) => setSpriteOptions((p) => ({ ...p, maxHeight: v }))}
                      step={10}
                      min={10}
                      max={2000}
                    />
                    <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700"></div>
                    <NumberStepper
                      label="Отступ"
                      value={spriteOptions.spacing}
                      onChange={(v) => setSpriteOptions((p) => ({ ...p, spacing: v }))}
                      step={1}
                      min={0}
                      max={100}
                    />

                    {/* Replaced manual picker with ColorInput */}
                    <ColorInput
                      value={spriteOptions.bg === 'transparent' ? null : spriteOptions.bg}
                      onChange={(v) => setSpriteOptions((p) => ({ ...p, bg: v }))}
                      allowTransparent
                      onClear={() => setSpriteOptions((p) => ({ ...p, bg: 'transparent' }))}
                    />
                  </div>
                )}

                <div className="custom-scrollbar overflow-x-auto bg-zinc-100 p-4 dark:bg-zinc-950">
                  <SpriteFrameList
                    frames={frames}
                    maxHeight={spriteOptions.maxHeight}
                    spacing={spriteOptions.spacing}
                    backgroundColor={spriteOptions.bg}
                    videoAspectRatio={videoRatio}
                  />
                </div>
              </ControlSection>
            </div>
          )}

          {/* Hidden Processing Elements */}
          <video
            ref={videoRef}
            className="pointer-events-none absolute top-0 left-0 -z-50 h-1 w-1 opacity-0"
            crossOrigin="anonymous"
            muted
            playsInline
          />
          <video
            ref={previewVideoRef}
            className="pointer-events-none absolute top-0 left-0 -z-50 h-1 w-1 opacity-0"
            crossOrigin="anonymous"
            muted
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* MODAL */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title={
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                Предпросмотр масштабов
              </div>
            }
            headerActions={
              <span className="font-mono text-xs text-zinc-500">FPS: {gifParams.fps}</span>
            }
            className="h-[92vh] w-[96vw] max-w-[1920px]"
          >
            <MultiScalePreview frames={frames.map((f) => f.dataUrl)} fps={gifParams.fps} />
          </Modal>
        </div>
      </Workbench.Stage>
    </Workbench.Root>
  );
}
