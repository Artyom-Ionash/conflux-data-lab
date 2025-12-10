"use client";

import type { CreateGIFResult } from "gifshot";
import gifshot from "gifshot";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// --- DOMAIN IMPORTS ---
import { TextureLimitIndicator } from "@/app/components/domain/hardware/TextureLimitIndicator";
import { FrameDiffOverlay } from "@/app/components/domain/video/analysis/FrameDiffOverlay";
// --- EXTRACTED COMPONENTS ---
import { DualHoverPreview } from "@/app/components/domain/video/DualHoverPreview";
import { MultiScalePreview } from "@/app/components/domain/video/MultiScalePreview";
import { RangeVideoPlayer } from "@/app/components/domain/video/player/RangeVideoPlayer";
import { SpriteFrameList } from "@/app/components/domain/video/SpriteFrameList";
import { TEXTURE_LIMITS } from "@/lib/domain/hardware/texture-standards";

// --- UI IMPORTS ---
import { Card } from "../../ui/Card";
import { FileDropzone, FileDropzonePlaceholder } from "../../ui/FileDropzone";
import { ImageSequencePlayer } from "../../ui/ImageSequencePlayer";
import { Modal } from "../../ui/Modal";
import { NumberStepper } from "../../ui/NumberStepper";
import { RangeSlider } from "../../ui/RangeSlider";
import { Switch } from "../../ui/Switch";
import { ToolLayout } from "../ToolLayout";

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

function useSpriteSheetGenerator() {
  const generateSpriteSheet = useCallback(
    async (frames: ExtractedFrame[], options: { maxHeight: number; spacing: number; backgroundColor: string }) => {
      const validFrames = frames.filter(f => f.dataUrl !== null);
      if (validFrames.length === 0) throw new Error("No frames");

      const firstImage = new Image();
      await new Promise<void>((resolve) => { firstImage.onload = () => resolve(); firstImage.src = validFrames[0].dataUrl!; });

      const scale = options.maxHeight / firstImage.height;
      const scaledWidth = Math.floor(firstImage.width * scale);
      const scaledHeight = options.maxHeight;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No context");

      canvas.width = (scaledWidth + options.spacing) * validFrames.length - options.spacing;
      canvas.height = scaledHeight;

      if (canvas.width > MAX_BROWSER_TEXTURE || canvas.height > MAX_BROWSER_TEXTURE) {
        throw new Error(`Размер текстуры (${canvas.width}x${canvas.height}) превышает лимит браузера (${MAX_BROWSER_TEXTURE}px).`);
      }

      if (options.backgroundColor !== "transparent") {
        ctx.fillStyle = options.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      for (let i = 0; i < validFrames.length; i++) {
        const img = new window.Image();
        await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = validFrames[i].dataUrl!; });
        const x = i * (scaledWidth + options.spacing);
        ctx.drawImage(img, x, 0, scaledWidth, scaledHeight);
      }
      return canvas.toDataURL("image/png");
    },
    []
  );
  return { generateSpriteSheet };
}

function useVideoFrameExtraction() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);

  const [extractionParams, setExtractionParams] = useState<ExtractionParams>({
    startTime: 0,
    endTime: 0,
    frameStep: 1,
    symmetricLoop: false
  });
  const [rawFrames, setRawFrames] = useState<ExtractedFrame[]>([]);

  const frames = useMemo(() => {
    if (rawFrames.length < 2) return rawFrames;
    if (!extractionParams.symmetricLoop) return rawFrames;
    const loopBack = rawFrames.slice(1, -1).reverse();
    return [...rawFrames, ...loopBack];
  }, [rawFrames, extractionParams.symmetricLoop]);

  const [gifParams, setGifParams] = useState({ fps: DEFAULT_FPS, dataUrl: null as string | null });
  const [status, setStatus] = useState({ isProcessing: false, currentStep: "", progress: 0 });
  const [error, setError] = useState<string | null>(null);

  const [previewFrames, setPreviewFrames] = useState<{ start: string | null, end: string | null }>({ start: null, end: null });
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const hoverVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const effectiveEnd = useMemo(() =>
    (extractionParams.endTime > 0 ? extractionParams.endTime : videoDuration ?? 0),
    [extractionParams.endTime, videoDuration]
  );

  // Auto-FPS Logic
  useEffect(() => {
    if (extractionParams.frameStep > 0) {
      const calculatedFps = Math.round(1 / extractionParams.frameStep);
      const safeFps = Math.max(1, Math.min(60, calculatedFps));
      setGifParams(prev => ({ ...prev, fps: safeFps }));
    }
  }, [extractionParams.frameStep]);

  useEffect(() => {
    return () => { if (videoSrc) URL.revokeObjectURL(videoSrc); };
  }, [videoSrc]);

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
        if (vid.readyState < 1) await new Promise<void>(r => { vid.onloadedmetadata = () => r(); });
        canvas.width = vid.videoWidth;
        canvas.height = vid.videoHeight;

        const safeStart = Math.max(0, extractionParams.startTime);
        const interval = extractionParams.frameStep;
        const steps = Math.floor((Math.min(effectiveEnd, videoDuration) - safeStart) / interval);
        const actualEndTime = safeStart + (steps * interval);

        // Generate Start Cache
        vid.currentTime = safeStart;
        await new Promise<void>(r => { vid.onseeked = () => r(); });
        ctx?.drawImage(vid, 0, 0);
        const startUrl = canvas.toDataURL('image/png');

        // Generate End Cache
        vid.currentTime = actualEndTime;
        await new Promise<void>(r => { vid.onseeked = () => r(); });
        ctx?.drawImage(vid, 0, 0);
        const endUrl = canvas.toDataURL('image/png');

        setPreviewFrames({ start: startUrl, end: endUrl });
      } catch (e) {
        console.error("Preview failed", e);
      } finally {
        setIsPreviewing(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [videoSrc, extractionParams.startTime, effectiveEnd, videoDuration, status.isProcessing, extractionParams.frameStep]);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const file = files[0];
    setRawFrames([]);
    setPreviewFrames({ start: null, end: null });
    setError(null);
    setGifParams(p => ({ ...p, dataUrl: null }));
    setVideoDuration(null);
    setVideoDimensions(null);

    if (videoSrc) URL.revokeObjectURL(videoSrc);
    const objectUrl = URL.createObjectURL(file);
    setVideoSrc(objectUrl);

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
        symmetricLoop: true
      });
    };
    tempVideo.onerror = () => setError("Ошибка загрузки");
  }, [videoSrc]);

  const runExtraction = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !videoSrc) return;
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;
    if (videoEl.src !== videoSrc) videoEl.src = videoSrc;

    setStatus({ isProcessing: true, currentStep: "extracting", progress: 0 });
    setError(null);
    setRawFrames([]);
    setGifParams(p => ({ ...p, dataUrl: null }));

    try {
      if (videoEl.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          videoEl.onloadedmetadata = () => resolve();
          videoEl.onerror = () => reject(new Error("Load failed"));
        });
      }

      const duration = videoEl.duration;
      const safeStart = Math.max(0, extractionParams.startTime);
      const interval = extractionParams.frameStep;
      if (interval <= 0) throw new Error("Invalid step");

      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
      const ctx = canvasEl.getContext("2d");
      if (!ctx) throw new Error("No ctx");

      const numberOfSteps = Math.floor((Math.min(effectiveEnd, duration) - safeStart) / interval);

      const initialFrames: ExtractedFrame[] = [];
      for (let i = 0; i <= numberOfSteps; i++) {
        initialFrames.push({ time: safeStart + (i * interval), dataUrl: null });
      }
      setRawFrames(initialFrames);

      const totalSteps = numberOfSteps + 1;
      for (let i = 0; i <= numberOfSteps; i++) {
        if (signal.aborted) throw new Error("Aborted");
        const current = safeStart + (i * interval);
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
            const url = canvasEl.toDataURL("image/png");
            setRawFrames(prev => prev.map((f, idx) => idx === i ? { ...f, dataUrl: url } : f));
            resolve();
          };
          videoEl.currentTime = current;
          videoEl.onseeked = onSeeked;
        });
        setStatus(s => ({ ...s, progress: Math.min(100, ((i + 1) / totalSteps) * 100) }));
        await new Promise(r => requestAnimationFrame(r));
      }
      setStatus({ isProcessing: false, currentStep: "", progress: 100 });
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== "Aborted") {
        setError(e.message);
        setStatus({ isProcessing: false, currentStep: "", progress: 0 });
      } else if (!(e instanceof Error)) {
        setError("Error");
        setStatus({ isProcessing: false, currentStep: "", progress: 0 });
      }
    }
  }, [videoSrc, extractionParams.startTime, extractionParams.frameStep, effectiveEnd]);

  useEffect(() => {
    if (!videoSrc) return;
    const timer = setTimeout(() => runExtraction(), 600);
    return () => clearTimeout(timer);
  }, [runExtraction, videoSrc]);

  const generateAndDownloadGif = useCallback(() => {
    const validFrames = frames.filter(f => f.dataUrl !== null);
    if (validFrames.length === 0) return;

    setStatus({ isProcessing: true, currentStep: "generating", progress: 0 });
    setError(null);

    setTimeout(() => {
      if (typeof gifshot !== 'undefined') {
        gifshot.createGIF({
          images: validFrames.map(f => f.dataUrl!),
          interval: 1 / gifParams.fps,
          gifWidth: videoDimensions?.width || 300,
          gifHeight: videoDimensions?.height || 200,
          numFrames: validFrames.length,
        }, (obj: CreateGIFResult) => {
          if (!obj.error && obj.image) {
            const a = document.createElement('a');
            a.href = obj.image;
            a.download = 'animation.gif';
            a.click();
            setGifParams(p => ({ ...p, dataUrl: obj.image ?? null }));
          } else {
            setError(`Error: ${obj.errorCode ?? obj.errorMsg ?? "unknown"}`);
          }
          setStatus({ isProcessing: false, currentStep: "", progress: 0 });
        });
      }
    }, 50);
  }, [frames, gifParams.fps, videoDimensions]);

  return {
    videoRef, previewVideoRef, hoverVideoRef, canvasRef, videoSrc, videoDuration, videoDimensions,
    extractionParams, setExtractionParams, frames, gifParams, setGifParams, status, error, effectiveEnd,
    previewFrames, isPreviewing, handleFilesSelected, runExtraction, generateAndDownloadGif
  };
}

// --- MAIN COMPONENT ---

export function VideoFrameExtractor() {
  const {
    videoRef, previewVideoRef, hoverVideoRef, canvasRef, videoSrc, videoDuration, videoDimensions,
    extractionParams, setExtractionParams, frames, gifParams, setGifParams, status, error, effectiveEnd,
    previewFrames, isPreviewing, handleFilesSelected, generateAndDownloadGif
  } = useVideoFrameExtraction();

  // Local UI State
  const [spriteOptions, setSpriteOptions] = useState({ maxHeight: 300, spacing: 0, bg: "transparent" });
  const [pickerValue, setPickerValue] = useState("#ffffff");
  const [diffDataUrl, setDiffDataUrl] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Hover Preview State
  const [hoverPreview, setHoverPreview] = useState<{ activeThumb: 0 | 1; time: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const sliderContainerRef = useRef<HTMLDivElement>(null);

  const { generateSpriteSheet } = useSpriteSheetGenerator();

  // Draw overlay for SequencePlayer
  const handleDrawOverlay = useCallback((ctx: CanvasRenderingContext2D, index: number, w: number, h: number) => {
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
    const y = h - margin - (fontSize + (padY * 2));
    const boxWidth = textMetrics.width + (padX * 2);
    const boxHeight = fontSize + (padY * 2);

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
    ctx.fillText(timeText, x + padX, y + (boxHeight / 2));
  }, [frames]);

  const handleDownloadSpriteSheet = async () => {
    if (frames.length === 0) return;
    try {
      const url = await generateSpriteSheet(frames, {
        maxHeight: spriteOptions.maxHeight,
        spacing: spriteOptions.spacing,
        backgroundColor: spriteOptions.bg
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = 'spritesheet.png';
      a.click();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Ошибка генерации");
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPickerValue(e.target.value);
    setSpriteOptions(p => ({ ...p, bg: e.target.value }));
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
    setExtractionParams(p => ({ ...p, startTime: newValues[0], endTime: newValues[1] }));
    if (isDragging && typeof thumbIndex === 'number') {
      const changedTime = newValues[thumbIndex];
      setHoverPreview({ activeThumb: thumbIndex, time: changedTime });
      if (hoverVideoRef.current) hoverVideoRef.current.currentTime = changedTime;
    }
  };

  const sidebarContent = (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-2">
        <FileDropzone onFilesSelected={handleFilesSelected} multiple={false} accept="video/*" label="Загрузить видео" />
        {status.isProcessing && (
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800">
            <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1 flex justify-between">
              <span>Обработка...</span><span className="font-mono">{Math.round(status.progress)}%</span>
            </div>
            <div className="h-1 w-full bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${status.progress}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <ToolLayout title="Видео в Кадры/GIF" sidebar={sidebarContent}>
      <div className="relative w-full h-full flex flex-col bg-zinc-50 dark:bg-black/20 overflow-hidden">
        {!videoSrc ? (
          <div className="flex-1 p-8">
            <FileDropzonePlaceholder onUpload={handleFilesSelected} multiple={false} accept="video/*" title="Перетащите видеофайл" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* CONTROLS CARD */}
            <Card className="shadow-sm relative z-20 overflow-visible" contentClassName="p-4">
              <div className="flex flex-col gap-4">
                <div className="space-y-4">
                  {/* Top Bar: Stepper & Time Indicator */}
                  <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-6">
                    <div className="flex flex-wrap items-center gap-6">
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Диапазон</span>
                      <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 hidden sm:block"></div>
                      <NumberStepper
                        label="Шаг (сек)"
                        value={extractionParams.frameStep}
                        onChange={(v) => setExtractionParams(p => ({ ...p, frameStep: v }))}
                        step={0.05} min={0.05} max={10}
                      />
                    </div>
                    <div className="bg-black/80 text-white px-3 py-1.5 rounded text-xs font-mono font-bold ml-auto flex items-center gap-2 shadow-sm">
                      <span>{extractionParams.startTime.toFixed(2)}s</span>
                      <span className="opacity-50">→</span>
                      <span>{effectiveEnd.toFixed(2)}s</span>
                    </div>
                  </div>

                  {/* Range Slider with Dual Preview */}
                  <div
                    ref={sliderContainerRef}
                    className="relative group py-2 touch-none"
                    onMouseMove={handleSliderHover}
                    onMouseLeave={() => !isDragging && setHoverPreview(null)}
                    onPointerDown={() => setIsDragging(true)}
                    onPointerUp={() => { setIsDragging(false); setHoverPreview(null); }}
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
                {error && <div className="text-xs text-red-600 text-right">{error}</div>}
              </div>
            </Card>

            {/* PREVIEW GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 1. Source Video */}
              <Card className="overflow-hidden flex flex-col shadow-sm" title={<span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Исходное видео</span>} contentClassName="p-0">
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
                className="overflow-hidden flex flex-col shadow-sm"
                title={<span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Разница</span>}
                headerActions={diffDataUrl ? (
                  <button onClick={() => { const a = document.createElement('a'); a.href = diffDataUrl; a.download = 'diff.png'; a.click(); }} className="text-xs text-blue-600 hover:underline font-medium">Скачать</button>
                ) : undefined}
                contentClassName="p-0"
              >
                <div className="relative w-full bg-zinc-100 dark:bg-zinc-950" style={aspectRatioStyle}>
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
                className="overflow-hidden flex flex-col shadow-sm"
                title={
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Спрайт</span>
                    <NumberStepper
                      label="Скорость %"
                      value={Math.round((gifParams.fps / (extractionParams.frameStep > 0 ? Math.round(1 / extractionParams.frameStep) : 10)) * 100)}
                      onChange={(val) => {
                        const base = (extractionParams.frameStep > 0 ? Math.round(1 / extractionParams.frameStep) : 10);
                        setGifParams(p => ({ ...p, fps: Math.max(1, Math.round(base * (val / 100))) }));
                      }}
                      min={10} max={500} step={10}
                    />
                    <NumberStepper label="FPS" value={gifParams.fps} onChange={() => { }} disabled={true} />
                  </div>
                }
                headerActions={frames.length > 0 && !status.isProcessing ? (
                  <button onClick={generateAndDownloadGif} disabled={status.isProcessing} className="text-xs text-blue-600 hover:underline font-medium disabled:opacity-50">
                    {status.currentStep === 'generating' ? 'Кодирование...' : 'Скачать GIF'}
                  </button>
                ) : undefined}
                contentClassName="p-0"
              >
                <div
                  className="relative w-full bg-zinc-100 dark:bg-zinc-950 cursor-pointer group"
                  style={aspectRatioStyle}
                  onClick={() => setIsModalOpen(true)}
                  title="Нажмите, чтобы открыть предпросмотр масштабов"
                >
                  {(frames.length > 0 || status.isProcessing) ? (
                    <>
                      <ImageSequencePlayer
                        images={frames.map(f => f.dataUrl)}
                        fps={gifParams.fps}
                        width={videoDimensions?.width || 300}
                        height={videoDimensions?.height || 200}
                        onDrawOverlay={handleDrawOverlay}
                      />
                      {status.isProcessing && (
                        <div className="absolute inset-0 flex flex-col justify-end bg-black/5 backdrop-blur-[1px]">
                          <div className="w-full bg-black/10 h-1"><div className="h-full bg-blue-500 transition-all duration-200" style={{ width: `${status.progress}%` }} /></div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 bg-black/70 text-white px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm transition-opacity transform scale-95 group-hover:scale-100">
                          Открыть масштабы ⤢
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">Нет кадров</div>
                  )}
                </div>
              </Card>
            </div>

            {/* SPRITE SHEET SETTINGS & LIST */}
            <Card
              className="flex flex-col shadow-sm"
              title={
                <div className="flex items-center gap-6">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Спрайт-лист</span>
                  {frames.length > 0 && (
                    <div className="flex items-center gap-4">
                      <Switch label="Loop" checked={extractionParams.symmetricLoop} onCheckedChange={(c) => setExtractionParams(p => ({ ...p, symmetricLoop: c }))} className="whitespace-nowrap gap-2 text-xs font-medium" />
                      <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700"></div>

                      <NumberStepper label="Высота" value={spriteOptions.maxHeight} onChange={(v) => setSpriteOptions(p => ({ ...p, maxHeight: v }))} step={10} min={10} max={2000} />
                      <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700"></div>
                      <NumberStepper label="Отступ" value={spriteOptions.spacing} onChange={(v) => setSpriteOptions(p => ({ ...p, spacing: v }))} step={1} min={0} max={100} />

                      {/* Color Picker */}
                      <div className="relative w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden cursor-pointer hover:border-zinc-400 shadow-sm transition-colors">
                        <input type="color" className="absolute opacity-0 inset-0 w-full h-full cursor-pointer z-10" value={pickerValue} onInput={handleColorChange} />
                        <div className="absolute inset-0 z-0 bg-white" style={{ backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)', backgroundSize: '8px 8px' }} />
                        <div className="absolute inset-0 z-1" style={{ backgroundColor: spriteOptions.bg === 'transparent' ? 'transparent' : spriteOptions.bg }} />
                      </div>
                      {spriteOptions.bg !== 'transparent' && <button onClick={() => setSpriteOptions(p => ({ ...p, bg: 'transparent' }))} className="text-xs text-red-500 hover:text-red-700">Сброс</button>}
                    </div>
                  )}
                </div>
              }
              headerActions={frames.length > 0 ? (
                <div className="flex items-center gap-4">
                  <NumberStepper label="Кадров" value={frames.length} onChange={() => { }} disabled={true} />
                  <div className="w-48 pt-1"><TextureLimitIndicator value={totalSpriteWidth} label="ШИРИНА" /></div>
                  <button
                    onClick={handleDownloadSpriteSheet}
                    className={`text-xs font-bold transition-colors ${totalSpriteWidth > MAX_BROWSER_TEXTURE ? "text-zinc-400 cursor-not-allowed" : "text-blue-600 hover:underline"}`}
                    disabled={totalSpriteWidth > MAX_BROWSER_TEXTURE}
                  >
                    Скачать PNG
                  </button>
                </div>
              ) : undefined}
              contentClassName="p-0"
            >
              <div className="bg-zinc-100 dark:bg-zinc-950 p-4 overflow-x-auto custom-scrollbar">
                <SpriteFrameList
                  frames={frames}
                  maxHeight={spriteOptions.maxHeight}
                  spacing={spriteOptions.spacing}
                  backgroundColor={spriteOptions.bg}
                  videoAspectRatio={videoRatio}
                />
              </div>
            </Card>
          </div>
        )}

        {/* Hidden Processing Elements */}
        <video ref={videoRef} className="hidden" crossOrigin="anonymous" muted playsInline />
        <video ref={previewVideoRef} className="hidden" crossOrigin="anonymous" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />

        {/* MODAL */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={<div className="flex items-center gap-3"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />Предпросмотр масштабов</div>}
          headerActions={<span className="text-xs font-mono text-zinc-500">FPS: {gifParams.fps}</span>}
          className="w-[96vw] h-[92vh] max-w-[1920px]"
        >
          <MultiScalePreview frames={frames.map(f => f.dataUrl)} fps={gifParams.fps} />
        </Modal>
      </div>
    </ToolLayout>
  );
}