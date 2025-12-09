"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gifshot from "gifshot";

// UI Imports
import { ToolLayout } from "../ToolLayout";
import { FileDropzone, FileDropzonePlaceholder } from "../../ui/FileDropzone";
import { RangeSlider } from "../../ui/RangeSlider";
import { Switch } from "../../ui/Switch";
import { ImageSequencePlayer } from "../../ui/ImageSequencePlayer";

// Tool Specific Imports
import { RangeVideoPlayer } from "./RangeVideoPlayer";
import { FrameDiffOverlay } from "./FrameDiffOverlay";
import { TextureDimensionSlider } from "../../domain/graphics/TextureDimensionSlider";

// --- STYLES CONSTANTS ---
const TIMESTAMP_HTML_CLASS = "absolute bottom-2 left-2 pointer-events-none bg-black/80 text-white px-2 py-0.5 rounded text-[11px] font-bold font-mono shadow-sm backdrop-blur-[1px]";

// --- COMPONENTS ---

interface NumberStepperProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  className?: string;
  disabled?: boolean;
}

function NumberStepper({ value, onChange, min, max, step, label, className = "", disabled = false }: NumberStepperProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      onChange(val);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">{label}:</span>}

      <div className={`flex items-center h-8 border rounded-lg shadow-sm transition-colors 
        ${disabled
          ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 cursor-default opacity-80"
          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
        }`}>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={handleChange}
          disabled={disabled}
          className={`w-16 h-full text-center text-sm font-mono font-bold bg-transparent outline-none appearance-none rounded-lg px-1
            ${disabled ? "text-zinc-500 pointer-events-none" : "text-zinc-700 dark:text-zinc-200"}`}
        />
      </div>
    </div>
  );
}

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

// --- HOOKS ---

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
  const [rawFrames, setRawFrames] = useState<ExtractedFrame[]>([]);

  const frames = useMemo(() => {
    if (rawFrames.length < 2) return rawFrames;
    if (!extractionParams.symmetricLoop) return rawFrames;
    const loopBack = rawFrames.slice(1, -1).reverse();
    return [...rawFrames, ...loopBack];
  }, [rawFrames, extractionParams.symmetricLoop]);

  const [gifParams, setGifParams] = useState({ fps: 10, dataUrl: null as string | null });
  const [status, setStatus] = useState({ isProcessing: false, currentStep: "", progress: 0 });
  const [error, setError] = useState<string | null>(null);

  const [previewFrames, setPreviewFrames] = useState<{ start: string | null, end: string | null }>({ start: null, end: null });
  const [isPreviewing, setIsPreviewing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const effectiveEnd = useMemo(() => (extractionParams.endTime > 0 ? extractionParams.endTime : videoDuration ?? 0), [extractionParams.endTime, videoDuration]);

  // --- AUTO-FPS LOGIC ---
  useEffect(() => {
    if (extractionParams.frameStep > 0) {
      const calculatedFps = Math.round(1 / extractionParams.frameStep);
      const safeFps = Math.max(1, Math.min(60, calculatedFps));
      setGifParams(prev => ({ ...prev, fps: safeFps }));
    }
  }, [extractionParams.frameStep]);

  useEffect(() => { return () => { if (videoSrc) URL.revokeObjectURL(videoSrc); }; }, [videoSrc]);

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

        vid.currentTime = safeStart;
        await new Promise<void>(r => { vid.onseeked = () => r(); });
        ctx?.drawImage(vid, 0, 0);
        const startUrl = canvas.toDataURL('image/png');

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
    setVideoFile(file);
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

      setExtractionParams({
        startTime: 0,
        endTime: Math.min(0.5, duration),
        frameStep: 0.1,
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
    } catch (e: any) {
      if (e.message !== "Aborted") {
        setError(e instanceof Error ? e.message : "Error");
        setStatus({ isProcessing: false, currentStep: "", progress: 0 });
      }
    }
  }, [videoSrc, extractionParams.startTime, extractionParams.endTime, extractionParams.frameStep, effectiveEnd]);

  useEffect(() => {
    if (!videoSrc) return;
    const timer = setTimeout(() => runExtraction(), 600);
    return () => clearTimeout(timer);
  }, [runExtraction]);

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
        }, (obj: any) => {
          if (!obj.error) {
            const a = document.createElement('a');
            a.href = obj.image;
            a.download = 'animation.gif';
            a.click();
            setGifParams(p => ({ ...p, dataUrl: obj.image }));
          } else {
            setError("Error: " + obj.errorCode);
          }
          setStatus({ isProcessing: false, currentStep: "", progress: 0 });
        });
      }
    }, 50);
  }, [frames, gifParams.fps, videoDimensions]);

  return {
    videoRef, previewVideoRef, canvasRef, videoSrc, videoDuration, videoDimensions,
    extractionParams, setExtractionParams, frames, gifParams, setGifParams, status, error, effectiveEnd,
    previewFrames, isPreviewing, handleFilesSelected, runExtraction, generateAndDownloadGif
  };
}

// --- MAIN LAYOUT ---

export function VideoFrameExtractor() {
  const {
    videoRef, previewVideoRef, canvasRef, videoSrc, videoDuration, videoDimensions,
    extractionParams, setExtractionParams, frames, gifParams, setGifParams, status, error, effectiveEnd,
    previewFrames, isPreviewing, handleFilesSelected, generateAndDownloadGif
  } = useVideoFrameExtraction();

  const [spriteOptions, setSpriteOptions] = useState({ maxHeight: 300, spacing: 0, bg: "transparent" });
  const [pickerValue, setPickerValue] = useState("#ffffff");
  const [diffDataUrl, setDiffDataUrl] = useState<string | null>(null);

  const { generateSpriteSheet } = useSpriteSheetGenerator();

  const handleDrawOverlay = useCallback((ctx: CanvasRenderingContext2D, index: number, w: number, h: number) => {
    const frame = frames[index];
    if (!frame) return;

    const timeText = `${frame.time.toFixed(2)}s`;

    const fontSize = Math.max(14, Math.floor(w * 0.05));
    ctx.font = `bold ${fontSize}px monospace`;
    const textMetrics = ctx.measureText(timeText);

    const padX = fontSize * 0.6;
    const padY = fontSize * 0.4;
    const boxWidth = textMetrics.width + (padX * 2);
    const boxHeight = fontSize + (padY * 2);

    const margin = Math.max(8, w * 0.03);
    const x = margin;
    const y = h - margin - boxHeight;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.beginPath();
    const radius = fontSize * 0.4;
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, boxWidth, boxHeight, radius);
    } else {
      ctx.rect(x, y, boxWidth, boxHeight);
    }
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeText, x + padX, y + (boxHeight / 2) + (fontSize * 0.05));
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
    } catch (e) { console.error(e); }
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPickerValue(e.target.value);
    setSpriteOptions(p => ({ ...p, bg: e.target.value }));
  };

  const aspectRatioStyle = useMemo(() => {
    if (!videoDimensions) return {};
    return { aspectRatio: `${videoDimensions.width} / ${videoDimensions.height}` };
  }, [videoDimensions]);

  const sidebarContent = (
    <div className="flex flex-col gap-6 pb-4">
      <div className="flex flex-col gap-2">
        <FileDropzone onFilesSelected={handleFilesSelected} multiple={false} accept="video/*" label="Загрузить видео" />
        {status.isProcessing && (
          <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800">
            <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1 flex justify-between">
              <span>Обработка...</span>
              <span className="font-mono">{Math.round(status.progress)}%</span>
            </div>
            <div className="h-1 w-full bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${status.progress}%` }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // --- DERIVED SPEED VALUES ---
  const baseFps = extractionParams.frameStep > 0 ? Math.round(1 / extractionParams.frameStep) : 10;
  // Calculate speed percentage based on current FPS relative to base FPS
  const speedPercent = Math.round((gifParams.fps / baseFps) * 100);

  return (
    <ToolLayout title="Видео в Кадры/GIF" sidebar={sidebarContent}>
      <div className="relative w-full h-full flex flex-col bg-zinc-50 dark:bg-black/20 overflow-hidden">
        {!videoSrc ? (
          <div className="flex-1 p-8">
            <FileDropzonePlaceholder onUpload={handleFilesSelected} multiple={false} accept="video/*" title="Перетащите видеофайл" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* CONTROLS */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-y-3 gap-x-6">
                    <div className="flex flex-wrap items-center gap-6">
                      <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Диапазон</span>
                      <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-700 hidden sm:block"></div>

                      <NumberStepper
                        label="Шаг (сек)"
                        value={extractionParams.frameStep}
                        onChange={(v) => setExtractionParams(p => ({ ...p, frameStep: v }))}
                        step={0.05}
                        min={0.05}
                        max={10}
                      />

                      <Switch
                        label="Симметричный цикл"
                        checked={extractionParams.symmetricLoop}
                        onCheckedChange={(c) => setExtractionParams(p => ({ ...p, symmetricLoop: c }))}
                        className="whitespace-nowrap gap-2 text-xs font-medium"
                      />
                    </div>

                    {/* Time Range Indicator */}
                    <div className="bg-black/80 text-white px-3 py-1.5 rounded text-xs font-mono font-bold ml-auto flex items-center gap-2 shadow-sm">
                      <span>{extractionParams.startTime.toFixed(2)}s</span>
                      <span className="opacity-50">→</span>
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
                {error && <div className="text-xs text-red-600 text-right">{error}</div>}
              </div>
            </div>

            {/* PREVIEWS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Source Video */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col shadow-sm">
                <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-bold text-zinc-500 uppercase tracking-wide">
                  Исходное видео
                </div>
                <div className="relative w-full bg-black" style={aspectRatioStyle}>
                  <RangeVideoPlayer src={videoSrc} startTime={extractionParams.startTime} endTime={effectiveEnd} className="absolute inset-0" />
                </div>
              </div>

              {/* Diff Overlay */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col shadow-sm">
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Разница</span>
                  {diffDataUrl && <button onClick={() => { const a = document.createElement('a'); a.href = diffDataUrl; a.download = 'diff.png'; a.click(); }} className="text-xs text-blue-600 hover:underline font-medium">Скачать</button>}
                </div>
                <div className="relative w-full bg-zinc-100 dark:bg-zinc-950" style={aspectRatioStyle}>
                  <div className="absolute inset-0">
                    <FrameDiffOverlay image1={previewFrames.start} image2={previewFrames.end} isProcessing={isPreviewing} onDataGenerated={setDiffDataUrl} />
                  </div>
                </div>
              </div>

              {/* Sprite (Animation) Player */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col shadow-sm">
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 h-11">
                  <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Спрайт</span>

                    {/* Speed % Control */}
                    <NumberStepper
                      label="Скорость %"
                      value={speedPercent}
                      onChange={(val) => {
                        const newFps = Math.max(1, Math.round(baseFps * (val / 100)));
                        setGifParams(p => ({ ...p, fps: newFps }));
                      }}
                      min={10}
                      max={500}
                      step={10}
                    />

                    {/* Read-only FPS */}
                    <NumberStepper
                      label="FPS"
                      value={gifParams.fps}
                      onChange={() => { }}
                      disabled={true}
                    />
                  </div>
                  {frames.length > 0 && !status.isProcessing && (
                    <button onClick={generateAndDownloadGif} disabled={status.isProcessing} className="text-xs text-blue-600 hover:underline font-medium disabled:opacity-50">
                      {status.currentStep === 'generating' ? 'Кодирование...' : 'Скачать GIF'}
                    </button>
                  )}
                </div>
                <div className="relative w-full bg-zinc-100 dark:bg-zinc-950" style={aspectRatioStyle}>
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
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">Нет кадров</div>
                  )}
                </div>
              </div>
            </div>

            {/* SPRITE SHEET */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 flex flex-col shadow-sm">
              <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-6">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Спрайт-лист</span>
                  {frames.length > 0 && (
                    <div className="flex items-center gap-4">
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
                {frames.length > 0 && (
                  <div className="flex items-center gap-4">

                    {/* Frame Count Indicator */}
                    <NumberStepper
                      label="Кадров"
                      value={frames.length}
                      onChange={() => { }}
                      disabled={true}
                    />

                    <div className="w-40"><TextureDimensionSlider label="Ширина" value={(Math.floor(videoDimensions!.width * (spriteOptions.maxHeight / videoDimensions!.height)) + spriteOptions.spacing) * frames.length - spriteOptions.spacing} onChange={() => { }} max={16384} disabled /></div>
                    <button onClick={handleDownloadSpriteSheet} className="text-xs text-blue-600 hover:underline font-bold">Скачать PNG</button>
                  </div>
                )}
              </div>

              <div className="bg-zinc-100 dark:bg-zinc-950 p-4 overflow-x-auto custom-scrollbar">
                {frames.length > 0 ? (
                  <div className={`flex items-start border border-dashed border-zinc-300 dark:border-zinc-700 ${spriteOptions.bg === 'transparent' ? "bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAKQCAYAAAB2440yAAAAIklEQVQ4jWNgGAWjYBQMBAAABgAB/6Zj+QAAAABJRU5ErkJggg==')] bg-repeat" : ""}`} style={{ backgroundColor: spriteOptions.bg !== 'transparent' ? spriteOptions.bg : undefined, gap: `${spriteOptions.spacing}px` }}>
                    {frames.map((frame, idx) => (
                      <div key={idx} className="relative shrink-0 group">
                        {frame.dataUrl ? (
                          <img src={frame.dataUrl} alt="frame" style={{ height: spriteOptions.maxHeight, display: 'block' }} className="shadow-sm rounded-sm" />
                        ) : (
                          <div className="animate-pulse bg-black/5 rounded-sm" style={{ height: spriteOptions.maxHeight, width: Math.floor((videoDimensions?.width || 100) * (spriteOptions.maxHeight / (videoDimensions?.height || 100))) }} />
                        )}
                        <div className={TIMESTAMP_HTML_CLASS}>{frame.time.toFixed(2)}s</div>
                        <div className="absolute top-2 right-2 bg-black/60 text-white px-1.5 py-0.5 rounded text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">#{idx + 1}</div>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-center text-zinc-400 py-8">Нет кадров</div>}
              </div>
            </div>
          </div>
        )}

        {/* Hidden */}
        <video ref={videoRef} className="hidden" crossOrigin="anonymous" muted playsInline />
        <video ref={previewVideoRef} className="hidden" crossOrigin="anonymous" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </ToolLayout>
  );
}