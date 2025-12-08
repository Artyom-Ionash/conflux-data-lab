"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gifshot from "gifshot";

// UI Imports
import { ToolLayout } from "../ToolLayout";
import { FileDropzone, FileDropzonePlaceholder } from "../../ui/FileDropzone";
import { RangeSlider } from "../../ui/RangeSlider";
import { Switch } from "../../ui/Switch";
import { RangeVideoPlayer } from "./RangeVideoPlayer";
import { FrameDiffOverlay } from "./FrameDiffOverlay";
// Import Domain Components
import { TextureDimensionSlider } from "../../domain/graphics/TextureDimensionSlider";

// --- 1. DOMAIN TYPES ---
export interface ExtractedFrame {
  time: number;
  dataUrl: string;
}

export type ExtractionStep = "extracting" | "generating" | "";

export interface ExtractionParams {
  startTime: number;
  endTime: number;
  frameStep: number;
  symmetricLoop: boolean;
}

export interface GifParams {
  fps: number;
  dataUrl: string | null;
}

export interface ExtractionStatus {
  isProcessing: boolean;
  currentStep: ExtractionStep;
  progress: number;
}

// --- 2. GENERIC UI COMPONENTS ---

interface FramePlayerProps {
  images: string[];
  fps: number;
  width?: number;
  height?: number;
  className?: string;
}

export function FramePlayer({ images, fps, width, height, className }: FramePlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const indexRef = useRef(0);

  // Reset logic handled gently to allow smooth looping
  if (indexRef.current >= images.length) {
    indexRef.current = 0;
  }

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      const interval = 1000 / fps;

      if (deltaTime > interval) {
        previousTimeRef.current = time - (deltaTime % interval);

        if (images.length > 0) {
          indexRef.current = (indexRef.current + 1) % images.length;
          const imageUrl = images[indexRef.current];

          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');

          if (canvas && ctx) {
            const img = new Image();
            img.src = imageUrl;

            if (img.complete) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            } else {
              img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              };
            }
          }
        }
      }
    } else {
      previousTimeRef.current = time;
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [images, fps]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  useEffect(() => {
    if (images.length > 0 && canvasRef.current) {
      const img = new Image();
      img.src = images[0];
      img.onload = () => {
        const w = width || canvasRef.current!.width;
        const h = height || canvasRef.current!.height;
        canvasRef.current?.getContext('2d')?.drawImage(img, 0, 0, w, h);
      };
    }
  }, [images]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className || "w-full h-full object-contain"}
    />
  );
}

// --- 3. LOGIC & HOOKS ---

function useSpriteSheetGenerator() {
  const generateSpriteSheet = useCallback(
    async (frames: ExtractedFrame[], options: { maxHeight: number; spacing: number; backgroundColor: string }) => {
      if (frames.length === 0) throw new Error("No frames");

      const firstImage = new Image();
      await new Promise<void>((resolve) => { firstImage.onload = () => resolve(); firstImage.src = frames[0].dataUrl; });

      const scale = options.maxHeight / firstImage.height;
      const scaledWidth = Math.floor(firstImage.width * scale);
      const scaledHeight = options.maxHeight;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("No context");

      canvas.width = (scaledWidth + options.spacing) * frames.length - options.spacing;
      canvas.height = scaledHeight;

      if (options.backgroundColor !== "transparent") {
        ctx.fillStyle = options.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      for (let i = 0; i < frames.length; i++) {
        const img = new Image();
        await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = frames[i].dataUrl; });
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
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);

  const [extractionParams, setExtractionParams] = useState<ExtractionParams>({ startTime: 0, endTime: 0, frameStep: 1, symmetricLoop: false });

  // RAW frames (directly from video extraction loop)
  const [rawFrames, setRawFrames] = useState<ExtractedFrame[]>([]);

  // PROCESSED frames (memoized to handle symmetry instantly without re-extraction)
  const frames = useMemo(() => {
    if (rawFrames.length < 2) return rawFrames;
    if (!extractionParams.symmetricLoop) return rawFrames;

    // Symmetric Logic: [0, 1, 2, 3] -> [0, 1, 2, 3, 2, 1]
    const loopBack = rawFrames.slice(1, -1).reverse();
    return [...rawFrames, ...loopBack];
  }, [rawFrames, extractionParams.symmetricLoop]);

  const [gifParams, setGifParams] = useState<GifParams>({ fps: 5, dataUrl: null });
  const [status, setStatus] = useState<ExtractionStatus>({ isProcessing: false, currentStep: "", progress: 0 });
  const [error, setError] = useState<string | null>(null);

  const [previewFrames, setPreviewFrames] = useState<{ start: string | null, end: string | null }>({ start: null, end: null });
  const [isPreviewing, setIsPreviewing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const effectiveEnd = useMemo(() => (extractionParams.endTime > 0 ? extractionParams.endTime : videoDuration ?? 0), [extractionParams.endTime, videoDuration]);

  useEffect(() => { return () => { if (videoSrc) URL.revokeObjectURL(videoSrc); }; }, [videoSrc]);

  // Preview Start/End frames logic (Calculated Times)
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
        const safeEnd = Math.min(effectiveEnd, videoDuration);
        const interval = extractionParams.frameStep;

        const steps = Math.floor((safeEnd - safeStart) / interval);
        const actualEndTime = safeStart + (steps * interval);

        // Capture Start
        vid.currentTime = safeStart;
        await new Promise<void>(r => { vid.onseeked = () => r(); });
        ctx?.drawImage(vid, 0, 0);
        const startUrl = canvas.toDataURL('image/png');

        // Capture End
        vid.currentTime = actualEndTime;
        await new Promise<void>(r => { vid.onseeked = () => r(); });
        ctx?.drawImage(vid, 0, 0);
        const endUrl = canvas.toDataURL('image/png');

        setPreviewFrames({ start: startUrl, end: endUrl });
      } catch (e) {
        console.error("Preview generation failed", e);
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
    extractionParams.frameStep
  ]);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const file = files[0];
    setVideoFile(file);
    setRawFrames([]);
    setPreviewFrames({ start: null, end: null });
    setError(null);
    setGifParams((p) => ({ ...p, dataUrl: null }));
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

      const defaultStep = Math.max(0.5, duration / 10);
      setExtractionParams((p) => ({
        ...p,
        startTime: 0,
        endTime: duration,
        frameStep: Number(defaultStep.toFixed(2))
      }));
    };
    tempVideo.onerror = () => setError("Ошибка загрузки видео");
  }, [videoSrc]);

  const runExtraction = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !videoSrc) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
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
          videoEl.onerror = () => reject(new Error("Video load failed"));
        });
      }

      const duration = videoEl.duration;
      const safeStart = Math.max(0, extractionParams.startTime);
      const safeEnd = Math.min(effectiveEnd, duration);
      const interval = extractionParams.frameStep;

      if (interval <= 0) throw new Error("Invalid frame step");

      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
      const ctx = canvasEl.getContext("2d");
      if (!ctx) throw new Error("Canvas context failed");

      const numberOfSteps = Math.floor((safeEnd - safeStart) / interval);
      const actualEndTime = safeStart + (numberOfSteps * interval);

      // 1. Priority Capture Start
      videoEl.currentTime = safeStart;
      await new Promise<void>(resolve => { videoEl.onseeked = () => resolve(); });
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      const startFrameUrl = canvasEl.toDataURL("image/png");

      // 2. Priority Capture End
      videoEl.currentTime = actualEndTime;
      await new Promise<void>(resolve => { videoEl.onseeked = () => resolve(); });
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      const endFrameUrl = canvasEl.toDataURL("image/png");

      setPreviewFrames({ start: startFrameUrl, end: endFrameUrl });

      const totalSteps = numberOfSteps + 1;

      // 3. Loop Generation (Populating Raw Frames)
      for (let i = 0; i <= numberOfSteps; i++) {
        if (signal.aborted) throw new Error("Aborted");

        const current = safeStart + (i * interval);

        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
            const url = canvasEl.toDataURL("image/png");
            const newFrame = { time: current, dataUrl: url };

            setRawFrames(prev => [...prev, newFrame]);

            resolve();
          };
          videoEl.currentTime = current;
          videoEl.onseeked = onSeeked;
        });

        setStatus(s => ({ ...s, progress: Math.min(100, ((i + 1) / totalSteps) * 100) }));
        await new Promise(r => requestAnimationFrame(r));
      }

      setStatus({ isProcessing: false, currentStep: "", progress: 100 });

    } catch (e: any) {
      if (e.message !== "Aborted") {
        setError(e instanceof Error ? e.message : "Error");
        setStatus({ isProcessing: false, currentStep: "", progress: 0 });
      }
    }
  }, [videoSrc, extractionParams.startTime, extractionParams.endTime, extractionParams.frameStep, effectiveEnd]);

  // --- AUTO UPDATE EFFECT ---
  useEffect(() => {
    if (!videoSrc) return;
    const timer = setTimeout(() => {
      runExtraction();
    }, 600);
    return () => clearTimeout(timer);
  }, [runExtraction]);

  const generateAndDownloadGif = useCallback(() => {
    if (frames.length === 0) return;

    setStatus({ isProcessing: true, currentStep: "generating", progress: 0 });
    setError(null);

    setTimeout(() => {
      if (typeof gifshot !== 'undefined') {
        const width = videoDimensions?.width || 300;
        const height = videoDimensions?.height || 200;

        gifshot.createGIF({
          images: frames.map(f => f.dataUrl),
          interval: 1 / gifParams.fps,
          gifWidth: width,
          gifHeight: height,
          numFrames: frames.length,
        }, (obj: any) => {
          if (!obj.error) {
            const a = document.createElement('a');
            a.href = obj.image;
            a.download = 'animation.gif';
            a.click();
            setGifParams(p => ({ ...p, dataUrl: obj.image }));
          } else {
            setError("Ошибка создания GIF: " + obj.errorCode);
          }
          setStatus({ isProcessing: false, currentStep: "", progress: 0 });
        });
      } else {
        setStatus({ isProcessing: false, currentStep: "", progress: 0 });
      }
    }, 50);

  }, [frames, gifParams.fps, videoDimensions]);

  return {
    videoRef, previewVideoRef, canvasRef, videoSrc, videoDuration, videoDimensions,
    extractionParams, setExtractionParams,
    frames, gifParams, setGifParams, status, error, effectiveEnd,
    previewFrames, isPreviewing,
    handleFilesSelected, runExtraction, generateAndDownloadGif,
    videoFile
  };
}

// --- 4. MAIN LAYOUT COMPONENT ---

export function VideoFrameExtractor() {
  const {
    videoRef, previewVideoRef, canvasRef, videoSrc, videoDuration, videoDimensions,
    extractionParams, setExtractionParams,
    frames, gifParams, setGifParams, status, error, effectiveEnd,
    previewFrames, isPreviewing,
    handleFilesSelected, runExtraction, generateAndDownloadGif
  } = useVideoFrameExtraction();

  const [spriteOptions, setSpriteOptions] = useState({ maxHeight: 300, spacing: 0, bg: "transparent" });
  // Для управления инпутом цвета, если выбран "прозрачный", храним последнее значение или белый
  const [pickerValue, setPickerValue] = useState("#ffffff");

  const [diffDataUrl, setDiffDataUrl] = useState<string | null>(null);

  const { generateSpriteSheet } = useSpriteSheetGenerator();

  // --- AUTO-DETECT BACKGROUND COLOR FROM FIRST FRAME ---
  useEffect(() => {
    // Срабатываем, когда появляются кадры (например, после извлечения)
    if (frames.length > 0) {
      const firstFrameUrl = frames[0].dataUrl;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;

          // Если пиксель полностью прозрачный - ставим transparent
          // Если есть цвет - конвертируем в hex
          if (a === 0) {
            setSpriteOptions(prev => ({ ...prev, bg: "transparent" }));
          } else {
            const toHex = (c: number) => c.toString(16).padStart(2, '0');
            const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
            setSpriteOptions(prev => ({ ...prev, bg: hex }));
            setPickerValue(hex);
          }
        }
      };
      img.src = firstFrameUrl;
    }
  }, [frames]); // Зависимость от frames - пересчитываем при новом наборе кадров

  const handleDownloadSpriteSheet = async () => {
    if (frames.length === 0) return;
    try {
      // Generating ONLY on click
      const url = await generateSpriteSheet(frames, {
        maxHeight: spriteOptions.maxHeight,
        spacing: spriteOptions.spacing,
        backgroundColor: spriteOptions.bg
      });
      const a = document.createElement('a');
      a.href = url;
      a.download = 'spritesheet.png';
      a.click();
    } catch (e) {
      console.error(e);
    }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPickerValue(val);
    setSpriteOptions(prev => ({ ...prev, bg: val }));
  };

  const aspectRatioStyle = useMemo(() => {
    if (!videoDimensions) return {};
    return { aspectRatio: `${videoDimensions.width} / ${videoDimensions.height}` };
  }, [videoDimensions]);

  // Purely mathematical calculation, no generation involved
  const spriteDimensions = useMemo(() => {
    if (!videoDimensions || frames.length === 0) return { width: 0, height: 0 };
    const scale = spriteOptions.maxHeight / videoDimensions.height;
    const scaledWidth = Math.floor(videoDimensions.width * scale);
    const totalWidth = (scaledWidth + spriteOptions.spacing) * frames.length - spriteOptions.spacing;
    return { width: totalWidth, height: spriteOptions.maxHeight };
  }, [videoDimensions, frames.length, spriteOptions.maxHeight, spriteOptions.spacing]);

  const sidebarContent = (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-2">
        <FileDropzone onFilesSelected={handleFilesSelected} multiple={false} accept="video/*" label="Загрузить видео" />
      </div>
    </div>
  );

  return (
    <ToolLayout title="Видео в Кадры/GIF" sidebar={sidebarContent}>
      <div className="relative w-full h-full flex flex-col bg-zinc-50/50 dark:bg-black/20 overflow-hidden">

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
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* SETTINGS */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm p-4">
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Диапазон извлечения</span>
                    <div className="flex gap-2 text-xs font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                      <span>{extractionParams.startTime.toFixed(2)}s</span>
                      <span className="text-zinc-400">→</span>
                      <span>{effectiveEnd.toFixed(2)}s</span>
                    </div>
                  </div>
                  <RangeSlider
                    min={0}
                    max={videoDuration ?? 0}
                    step={0.01}
                    value={[extractionParams.startTime, effectiveEnd]}
                    onValueChange={([s, e]) => setExtractionParams(p => ({ ...p, startTime: s, endTime: e }))}
                    minStepsBetweenThumbs={0.1}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-6 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Шаг (сек):</span>
                      <input
                        type="number" min="0.01" step="0.05"
                        value={extractionParams.frameStep}
                        onChange={(e) => setExtractionParams(p => ({ ...p, frameStep: parseFloat(e.target.value) }))}
                        className="w-16 rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-800"
                      />
                    </div>
                    <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700"></div>
                    <div className="flex items-center">
                      <Switch
                        label="Симметричный цикл"
                        checked={extractionParams.symmetricLoop}
                        onCheckedChange={(c) => setExtractionParams(p => ({ ...p, symmetricLoop: c }))}
                        className="whitespace-nowrap gap-3"
                      />
                    </div>
                  </div>

                  <button
                    onClick={runExtraction}
                    disabled={status.isProcessing}
                    className="relative rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm hover:shadow-md uppercase tracking-wide overflow-hidden min-w-[140px]"
                  >
                    <span className="relative z-10">
                      {status.isProcessing && status.currentStep === 'extracting'
                        ? `Обновление ${Math.round(status.progress)}%`
                        : 'Обновить принудительно'}
                    </span>
                    {status.isProcessing && status.currentStep === 'extracting' && (
                      <div
                        className="absolute inset-0 bg-blue-500 transition-all duration-300 ease-out"
                        style={{ width: `${status.progress}%` }}
                      />
                    )}
                  </button>
                </div>
                {error && <div className="text-xs text-red-600 text-right">{error}</div>}
              </div>
            </div>

            {/* GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Video Player */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 h-10">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Исходное видео</h3>
                </div>
                <div className="relative w-full bg-black" style={aspectRatioStyle}>
                  <RangeVideoPlayer
                    src={videoSrc}
                    startTime={extractionParams.startTime}
                    endTime={effectiveEnd}
                    className="absolute inset-0"
                  />
                </div>
              </div>

              {/* Diff Overlay */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 h-10">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Разница (Начало/Конец)</h3>
                  {diffDataUrl && (
                    <button
                      onClick={() => { const a = document.createElement('a'); a.href = diffDataUrl; a.download = 'diff.png'; a.click(); }}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Скачать
                    </button>
                  )}
                </div>
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
              </div>

              {/* GIF Preview / Extracted Frames Player */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 h-10">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-2">
                    GIF Просмотр
                    <span className="text-[10px] text-zinc-400 font-medium ml-2">FPS:</span>
                    <input
                      type="number" min="1" max="60"
                      value={gifParams.fps}
                      onChange={(e) => setGifParams(p => ({ ...p, fps: parseFloat(e.target.value) }))}
                      className="w-10 text-[10px] px-1 py-0.5 border rounded dark:bg-zinc-800 dark:border-zinc-600 text-center"
                    />
                  </h3>
                  <div className="flex items-center gap-3">
                    {frames.length > 0 && !status.isProcessing && (
                      <button
                        onClick={generateAndDownloadGif}
                        disabled={status.isProcessing}
                        className="text-xs text-blue-600 hover:underline font-medium disabled:opacity-50"
                      >
                        {status.currentStep === 'generating' ? 'Кодирование...' : 'Скачать .GIF'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="relative w-full bg-zinc-100 dark:bg-zinc-950" style={aspectRatioStyle}>

                  {/* PLAYER & LOADING OVERLAY COMBINATION */}
                  {(frames.length > 0 || status.isProcessing) ? (
                    <>
                      <FramePlayer
                        images={frames.map(f => f.dataUrl)}
                        fps={gifParams.fps}
                        width={videoDimensions?.width || 300}
                        height={videoDimensions?.height || 200}
                      />

                      {/* Transparent Processing Overlay */}
                      {status.isProcessing && (
                        <div className="absolute inset-0 z-20 flex flex-col justify-end pointer-events-none bg-black/5 backdrop-blur-[1px] transition-all duration-300">
                          <div className="w-full bg-zinc-200/20 dark:bg-zinc-700/30 h-1">
                            <div
                              className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-200 ease-linear"
                              style={{ width: `${status.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Only show placeholder if strictly empty and idle */
                    <div className="absolute inset-0 flex items-center justify-center text-center p-4">
                      <p className="text-xs text-zinc-400">
                        Загрузите видео для предпросмотра
                      </p>
                    </div>
                  )}

                  {/* Generation Spinner (GIF encoding) - specific overlay */}
                  {status.currentStep === 'generating' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-white/50 dark:bg-black/50 backdrop-blur-[1px]">
                      <svg className="animate-spin h-8 w-8 text-blue-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300 bg-white/80 dark:bg-black/60 px-2 py-1 rounded">
                        Создание GIF...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SPRITE SHEET - ASYNC PREVIEW */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm flex flex-col min-h-[220px] h-auto transition-all duration-300 ease-in-out">
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                <div className="flex items-center gap-4">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide whitespace-nowrap">Спрайт-лист</h3>
                  {frames.length > 0 && (
                    <div className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-800/50 px-2 py-1 rounded border border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-500">Высота:</span>
                        <input
                          type="number"
                          className="w-12 text-[10px] px-1 py-0.5 border rounded dark:bg-zinc-800 dark:border-zinc-600"
                          value={spriteOptions.maxHeight}
                          onChange={(e) => setSpriteOptions(p => ({ ...p, maxHeight: Number(e.target.value) }))}
                        />
                      </div>
                      <div className="flex items-center gap-1 border-r border-zinc-200 dark:border-zinc-700 pr-3 mr-1">
                        <span className="text-[10px] text-zinc-500">Отступ:</span>
                        <input
                          type="number"
                          className="w-10 text-[10px] px-1 py-0.5 border rounded dark:bg-zinc-800 dark:border-zinc-600"
                          value={spriteOptions.spacing}
                          onChange={(e) => setSpriteOptions(p => ({ ...p, spacing: Number(e.target.value) }))}
                        />
                      </div>

                      {/* Color Picker Interface */}
                      <div className="flex items-center gap-1.5" title="Фон спрайт-листа">
                        <div className="relative w-5 h-5 rounded-full overflow-hidden border border-zinc-300 dark:border-zinc-600 shadow-sm cursor-pointer hover:scale-105 transition-transform group">
                          {/* Нативный инпут */}
                          <input
                            type="color"
                            className="absolute inset-0 w-[150%] h-[150%] p-0 m-0 -translate-x-1/4 -translate-y-1/4 cursor-pointer opacity-0 z-10"
                            value={pickerValue}
                            onInput={handleColorChange}
                          />
                          {/* Шахматка для прозрачности */}
                          <div className="absolute inset-0 z-0 bg-white"
                            style={{
                              backgroundImage: `linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
                              backgroundSize: '6px 6px',
                              backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px'
                            }}
                          />
                          {/* Выбранный цвет */}
                          <div
                            className="absolute inset-0 z-1 transition-colors duration-200"
                            style={{ backgroundColor: spriteOptions.bg === 'transparent' ? 'transparent' : spriteOptions.bg }}
                          />
                        </div>

                        {spriteOptions.bg !== 'transparent' && (
                          <button
                            onClick={() => setSpriteOptions(p => ({ ...p, bg: 'transparent' }))}
                            className="flex items-center justify-center w-4 h-4 text-zinc-400 hover:text-red-500 rounded-full transition-colors"
                            title="Сбросить на прозрачный"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                        )}
                      </div>

                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {frames.length > 0 && (
                    <div className="w-[180px]">
                      <TextureDimensionSlider
                        label="Итоговая ширина"
                        value={spriteDimensions.width}
                        onChange={() => { }}
                        max={16384 * 1.5}
                        className="mb-0"
                        disabled={true}
                      />
                    </div>
                  )}

                  {frames.length > 0 && !status.isProcessing && (
                    <button
                      onClick={handleDownloadSpriteSheet}
                      className="text-xs text-blue-600 hover:underline font-medium"
                    >
                      Скачать
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 bg-zinc-100 dark:bg-zinc-950 relative overflow-x-auto overflow-y-hidden custom-scrollbar">
                {frames.length > 0 ? (
                  <div className="h-full flex items-center px-4 py-4 min-w-fit">
                    {/* Visual Preview Container using Flex Gap to Simulate Sprite Sheet */}
                    <div
                      className={`flex items-start border border-dashed border-zinc-300 dark:border-zinc-700 ${spriteOptions.bg === 'transparent' ? "bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAKQCAYAAAB2440yAAAAIklEQVQ4jWNgGAWjYBQMBAAABgAB/6Zj+QAAAABJRU5ErkJggg==')] bg-repeat" : ""}`}
                      style={{
                        backgroundColor: spriteOptions.bg !== 'transparent' ? spriteOptions.bg : undefined,
                        gap: `${spriteOptions.spacing}px`
                      }}
                    >
                      {frames.map((frame, idx) => (
                        <div key={idx} className="flex flex-col shrink-0 group relative">
                          <img
                            src={frame.dataUrl}
                            alt={`Sprite ${idx}`}
                            style={{
                              height: spriteOptions.maxHeight,
                              display: 'block'
                            }}
                            className="bg-black/5"
                          />
                          {/* UI ONLY: Metadata Labels (Not included in download) */}
                          <div className="mt-1 flex justify-between text-[10px] text-zinc-500 font-mono px-0.5 select-none">
                            <span>{frame.time.toFixed(2)}s</span>
                            <span className="opacity-50">#{idx + 1}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-zinc-400">
                      {status.isProcessing ? "Генерация после извлечения..." : "Нет кадров"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="h-8"></div>
          </div>
        )}

        {/* Hidden Technical Elements */}
        <video ref={videoRef} className="hidden" crossOrigin="anonymous" muted playsInline />
        <video ref={previewVideoRef} className="hidden" crossOrigin="anonymous" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </ToolLayout>
  );
}