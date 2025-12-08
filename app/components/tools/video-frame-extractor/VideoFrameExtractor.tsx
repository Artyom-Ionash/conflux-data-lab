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

// --- CONSTANTS ---

// Базовые визуальные стили (черная плашка, белый текст, шрифт)
const TIMESTAMP_VISUALS = "bg-black/70 text-white px-2 py-0.5 rounded text-[11px] font-bold font-mono backdrop-blur-[2px] shadow-sm";

// Полный класс для абсолютного позиционирования на карточках
const TIMESTAMP_CLASS = `absolute bottom-2 left-2 pointer-events-none ${TIMESTAMP_VISUALS}`;

// --- 1. DOMAIN TYPES ---
export interface ExtractedFrame {
  time: number;
  dataUrl: string | null; // Allow null for placeholder state
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
  frames: ExtractedFrame[];
  fps: number;
  width?: number;
  height?: number;
  className?: string;
}

export function FramePlayer({ frames, fps, width, height, className }: FramePlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const indexRef = useRef(0);

  // Плеер теперь использует ВСЕ кадры, даже пустые (null), чтобы соблюдать тайминг
  // Сбрасываем индекс, если массив изменился и индекс вышел за пределы
  if (indexRef.current >= frames.length) {
    indexRef.current = 0;
  }

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      const interval = 1000 / fps;

      if (deltaTime > interval) {
        previousTimeRef.current = time - (deltaTime % interval);

        if (frames.length > 0) {
          indexRef.current = (indexRef.current + 1) % frames.length;
          const frame = frames[indexRef.current];

          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');

          if (canvas && ctx) {
            // Helper to draw timestamp (Unified Style emulation on Canvas)
            const drawTimestamp = () => {
              const timeText = `${frame.time.toFixed(2)}s`;
              ctx.font = 'bold 11px monospace';
              const textMetrics = ctx.measureText(timeText);

              const padX = 8;
              // const padY = 4;
              const boxHeight = 20;
              const boxWidth = textMetrics.width + (padX * 2);
              const x = 8;
              const y = canvas.height - 28; // bottom-left position

              // Background (Rounded Rect simulation)
              ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
              ctx.beginPath();
              if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(x, y, boxWidth, boxHeight, 4);
              } else {
                ctx.rect(x, y, boxWidth, boxHeight); // Fallback
              }
              ctx.fill();

              // Text
              ctx.fillStyle = 'white';
              ctx.textBaseline = 'middle';
              ctx.fillText(timeText, x + padX, y + (boxHeight / 2) + 1);
            };

            // LOGIC: If dataUrl exists -> Draw Image. If null -> Draw Placeholder BG.
            if (frame.dataUrl) {
              const img = new Image();
              img.src = frame.dataUrl;

              const onDraw = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                drawTimestamp();
              };

              if (img.complete) {
                onDraw();
              } else {
                img.onload = onDraw;
              }
            } else {
              // Placeholder State (Gray background)
              ctx.fillStyle = '#f4f4f5'; // zinc-100 equivalent
              ctx.fillRect(0, 0, canvas.width, canvas.height);

              // Optional: Draw a "loading" or "empty" icon/text
              ctx.fillStyle = '#d4d4d8'; // zinc-300
              ctx.font = '10px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('...', canvas.width / 2, canvas.height / 2);
              ctx.textAlign = 'start'; // reset

              drawTimestamp();
            }
          }
        }
      }
    } else {
      previousTimeRef.current = time;
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [frames, fps]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // Initial Paint (First frame only)
  useEffect(() => {
    if (frames.length > 0 && canvasRef.current) {
      const frame = frames[0];
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const w = width || canvasRef.current.width;
      const h = height || canvasRef.current.height;

      const drawInitialTimestamp = () => {
        const timeText = `${frame.time.toFixed(2)}s`;
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        const metrics = ctx.measureText(timeText);
        if (typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(8, h - 28, metrics.width + 16, 20, 4);
          ctx.fill();
        } else {
          ctx.fillRect(8, h - 28, metrics.width + 16, 20);
        }
        ctx.fillStyle = 'white';
        ctx.textBaseline = 'middle';
        ctx.fillText(timeText, 16, h - 18);
      };

      if (frame.dataUrl) {
        const img = new Image();
        img.src = frame.dataUrl;
        img.onload = () => {
          ctx.drawImage(img, 0, 0, w, h);
          drawInitialTimestamp();
        };
      } else {
        ctx.fillStyle = '#f4f4f5';
        ctx.fillRect(0, 0, w, h);
        drawInitialTimestamp();
      }
    }
  }, [frames]); // Re-run if frames array changes (e.g. reset)

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
      // Filter only completed frames
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

      if (options.backgroundColor !== "transparent") {
        ctx.fillStyle = options.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      for (let i = 0; i < validFrames.length; i++) {
        const img = new Image();
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
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);

  const [extractionParams, setExtractionParams] = useState<ExtractionParams>({ startTime: 0, endTime: 0, frameStep: 1, symmetricLoop: false });

  // RAW frames (may contain nulls for placeholders)
  const [rawFrames, setRawFrames] = useState<ExtractedFrame[]>([]);

  // PROCESSED frames (memoized to handle symmetry)
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

      // --- 0. PRE-CALCULATE TIMESTAMPS (PLACEHOLDERS) ---
      const initialFrames: ExtractedFrame[] = [];
      for (let i = 0; i <= numberOfSteps; i++) {
        initialFrames.push({ time: safeStart + (i * interval), dataUrl: null });
      }
      setRawFrames(initialFrames); // Immediate UI update with empty frames

      // 1. Priority Capture Start
      videoEl.currentTime = safeStart;
      await new Promise<void>(resolve => { videoEl.onseeked = () => resolve(); });
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      const startFrameUrl = canvasEl.toDataURL("image/png");

      // 2. Priority Capture End
      videoEl.currentTime = safeStart + (numberOfSteps * interval);
      await new Promise<void>(resolve => { videoEl.onseeked = () => resolve(); });
      ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
      const endFrameUrl = canvasEl.toDataURL("image/png");

      setPreviewFrames({ start: startFrameUrl, end: endFrameUrl });

      const totalSteps = numberOfSteps + 1;

      // 3. Loop Generation (Filling Raw Frames)
      for (let i = 0; i <= numberOfSteps; i++) {
        if (signal.aborted) throw new Error("Aborted");

        const current = safeStart + (i * interval);

        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
            const url = canvasEl.toDataURL("image/png");

            // Update specific frame in state without destroying others
            setRawFrames(prev => prev.map((f, idx) =>
              idx === i ? { ...f, dataUrl: url } : f
            ));

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
    // Filter out nulls
    const validFrames = frames.filter(f => f.dataUrl !== null);
    if (validFrames.length === 0) return;

    setStatus({ isProcessing: true, currentStep: "generating", progress: 0 });
    setError(null);

    setTimeout(() => {
      if (typeof gifshot !== 'undefined') {
        const width = videoDimensions?.width || 300;
        const height = videoDimensions?.height || 200;

        gifshot.createGIF({
          // BUG FIX: Added assertion '!' because filter ensures it's not null, but map returns (string|null)[] otherwise
          images: validFrames.map(f => f.dataUrl!),
          interval: 1 / gifParams.fps,
          gifWidth: width,
          gifHeight: height,
          numFrames: validFrames.length,
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
    // Срабатываем, когда появляется хотя бы один загруженный кадр (обычно первый)
    const firstLoadedFrame = frames.find(f => f.dataUrl !== null);

    if (firstLoadedFrame && firstLoadedFrame.dataUrl) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 1, 1, 0, 0, 1, 1);
          const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;

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
      img.src = firstLoadedFrame.dataUrl;
    }
  }, [frames]); // Re-run when frames update (specifically when first dataUrl becomes available)

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

  // Dimensions for placeholder
  const placeholderStyle = useMemo(() => {
    if (!videoDimensions) return { width: 100, height: spriteOptions.maxHeight };
    const scale = spriteOptions.maxHeight / videoDimensions.height;
    return {
      width: Math.floor(videoDimensions.width * scale),
      height: spriteOptions.maxHeight
    };
  }, [videoDimensions, spriteOptions.maxHeight]);

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

        {/* PROGRESS INDICATOR IN SIDEBAR */}
        {status.isProcessing && (
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1.5 flex justify-between items-center">
              <span>{status.currentStep === 'extracting' ? 'Извлечение...' : 'Обработка...'}</span>
              <span className="font-mono">{Math.round(status.progress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300 ease-out"
                style={{ width: `${status.progress}%` }}
              />
            </div>
          </div>
        )}
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
                <div className="space-y-3">
                  {/* HEADER ROW WITH CONTROLS */}
                  <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Диапазон извлечения</span>

                      <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 hidden sm:block"></div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-zinc-500">Шаг:</span>
                        <input
                          type="number" min="0.01" step="0.05"
                          value={extractionParams.frameStep}
                          onChange={(e) => setExtractionParams(p => ({ ...p, frameStep: parseFloat(e.target.value) }))}
                          className="w-14 rounded border border-zinc-300 bg-white px-1.5 py-0.5 text-xs text-center dark:border-zinc-700 dark:bg-zinc-800"
                        />
                        <span className="text-[10px] text-zinc-400">сек</span>
                      </div>

                      <div className="flex items-center">
                        <Switch
                          label="Симметричный цикл"
                          checked={extractionParams.symmetricLoop}
                          onCheckedChange={(c) => setExtractionParams(p => ({ ...p, symmetricLoop: c }))}
                          className="whitespace-nowrap gap-2 text-xs"
                        />
                      </div>
                    </div>

                    {/* Updated Time Range Display to match Timestamp Style */}
                    <div className={`flex items-center gap-2 ${TIMESTAMP_VISUALS} ml-auto`}>
                      <span>{extractionParams.startTime.toFixed(2)}s</span>
                      <span className="text-zinc-300 opacity-60">→</span>
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

                {error && <div className="text-xs text-red-600 text-right font-medium">{error}</div>}
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
                        frames={frames}
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
                        <div key={idx} className="relative shrink-0 group select-none">

                          {/* IMAGE OR PLACEHOLDER LOGIC */}
                          {frame.dataUrl ? (
                            <img
                              src={frame.dataUrl}
                              alt={`Sprite ${idx}`}
                              style={{
                                height: spriteOptions.maxHeight,
                                display: 'block',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                              }}
                              className="bg-black/5 rounded-sm"
                            />
                          ) : (
                            <div
                              className="rounded-sm transition-colors duration-500 animate-pulse border border-zinc-200 dark:border-zinc-800"
                              style={{
                                width: placeholderStyle.width,
                                height: placeholderStyle.height,
                                backgroundColor: spriteOptions.bg === 'transparent' ? 'rgba(0,0,0,0.05)' : spriteOptions.bg
                              }}
                            />
                          )}

                          {/* Timestamp - Bottom Left, Unified Style */}
                          <div className={TIMESTAMP_CLASS}>
                            {frame.time.toFixed(2)}s
                          </div>

                          {/* Index - Top Right, Fade in */}
                          <div className="absolute top-2 right-2 bg-black/60 text-white px-1.5 py-0.5 rounded text-[10px] font-mono backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            #{idx + 1}
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