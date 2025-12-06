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

// --- TYPES ---
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
}

// --- HELPER: SPRITESHEET GENERATOR ---
function useSpriteSheetGenerator() {
  const generateSpriteSheet = useCallback(
    async (frames: ExtractedFrame[], options: { maxHeight: number; spacing: number; backgroundColor: string }) => {
      if (frames.length === 0) throw new Error("Нет кадров");

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

// --- MAIN LOGIC HOOK ---
function useVideoFrameExtraction() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [extractionParams, setExtractionParams] = useState<ExtractionParams>({ startTime: 0, endTime: 0, frameStep: 1, symmetricLoop: false });
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [gifParams, setGifParams] = useState<GifParams>({ fps: 5, dataUrl: null });
  const [status, setStatus] = useState<ExtractionStatus>({ isProcessing: false, currentStep: "" });
  const [error, setError] = useState<string | null>(null);

  const [previewFrames, setPreviewFrames] = useState<{ start: string | null, end: string | null }>({ start: null, end: null });
  const [isPreviewing, setIsPreviewing] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const effectiveEnd = useMemo(() => (extractionParams.endTime > 0 ? extractionParams.endTime : videoDuration ?? 0), [extractionParams.endTime, videoDuration]);

  useEffect(() => { return () => { if (videoSrc) URL.revokeObjectURL(videoSrc); }; }, [videoSrc]);

  useEffect(() => {
    if (!videoSrc || !previewVideoRef.current || !canvasRef.current || !videoDuration) return;

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

        vid.currentTime = extractionParams.startTime;
        await new Promise<void>(r => { vid.onseeked = () => r(); });
        ctx?.drawImage(vid, 0, 0);
        const startUrl = canvas.toDataURL('image/png');

        vid.currentTime = effectiveEnd;
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
  }, [videoSrc, extractionParams.startTime, effectiveEnd, videoDuration]);


  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const file = files[0];
    setVideoFile(file);
    setFrames([]);
    setPreviewFrames({ start: null, end: null });
    setError(null);
    setGifParams((p) => ({ ...p, dataUrl: null }));
    setVideoDuration(null);
    setExtractionParams((p) => ({ ...p, startTime: 0, endTime: 0 }));

    if (videoSrc) URL.revokeObjectURL(videoSrc);
    const objectUrl = URL.createObjectURL(file);
    setVideoSrc(objectUrl);

    const tempVideo = document.createElement('video');
    tempVideo.src = objectUrl;
    tempVideo.onloadedmetadata = () => {
      const duration = tempVideo.duration || 0;
      setVideoDuration(duration);
      const defaultStep = Math.max(0.5, duration / 10);
      setExtractionParams((p) => ({ ...p, endTime: duration, frameStep: Number(defaultStep.toFixed(2)) }));
    };
    tempVideo.onerror = () => setError("Ошибка загрузки видео");
  }, [videoSrc]);

  const runExtraction = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !videoSrc) return;
    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;

    if (videoEl.src !== videoSrc) videoEl.src = videoSrc;

    setStatus({ isProcessing: true, currentStep: "extracting" });
    setError(null);
    setFrames([]);
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

      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
      const ctx = canvasEl.getContext("2d");
      if (!ctx) throw new Error("Canvas context failed");

      const resultFrames: ExtractedFrame[] = [];
      const interval = extractionParams.frameStep;

      for (let current = safeStart; current <= safeEnd; current += interval) {
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
            resultFrames.push({ time: current, dataUrl: canvasEl.toDataURL("image/png") });
            resolve();
          };
          videoEl.currentTime = current;
          videoEl.onseeked = onSeeked;
        });
      }

      let finalFrames = resultFrames;
      if (extractionParams.symmetricLoop && resultFrames.length > 1) {
        finalFrames = [...resultFrames, ...resultFrames.slice(1, -1).reverse()];
      }
      setFrames(finalFrames);

      if (finalFrames.length > 0) {
        setStatus({ isProcessing: true, currentStep: "generating" });
        if (typeof gifshot !== 'undefined') {
          gifshot.createGIF({
            images: finalFrames.map(f => f.dataUrl),
            interval: 1 / gifParams.fps,
            gifWidth: canvasEl.width,
            gifHeight: canvasEl.height,
            numFrames: finalFrames.length,
          }, (obj: any) => {
            if (!obj.error) setGifParams(p => ({ ...p, dataUrl: obj.image }));
            else setError("Ошибка создания GIF");
            setStatus({ isProcessing: false, currentStep: "" });
          });
        }
      } else {
        setStatus({ isProcessing: false, currentStep: "" });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setStatus({ isProcessing: false, currentStep: "" });
    }
  }, [videoSrc, extractionParams, effectiveEnd, gifParams.fps]);

  return {
    videoRef, previewVideoRef, canvasRef, videoSrc, videoDuration,
    extractionParams, setExtractionParams,
    frames, gifParams, setGifParams, status, error, effectiveEnd,
    previewFrames, isPreviewing,
    handleFilesSelected, runExtraction,
    videoFile
  };
}

// --- MAIN COMPONENT ---
export function VideoFrameExtractor() {
  const {
    videoRef, previewVideoRef, canvasRef, videoSrc, videoDuration,
    extractionParams, setExtractionParams,
    frames, gifParams, setGifParams, status, error, effectiveEnd,
    previewFrames, isPreviewing,
    handleFilesSelected, runExtraction
  } = useVideoFrameExtraction();

  const [spriteOptions, setSpriteOptions] = useState({ maxHeight: 300, spacing: 0, bg: "transparent" });
  const [spriteSheetUrl, setSpriteSheetUrl] = useState<string | null>(null);
  const { generateSpriteSheet } = useSpriteSheetGenerator();

  // Generate Sprite Sheet when frames change
  useEffect(() => {
    if (frames.length === 0) { setSpriteSheetUrl(null); return; }
    const timer = setTimeout(() => {
      generateSpriteSheet(frames, { maxHeight: spriteOptions.maxHeight, spacing: spriteOptions.spacing, backgroundColor: spriteOptions.bg })
        .then(setSpriteSheetUrl)
        .catch(console.error);
    }, 300);
    return () => clearTimeout(timer);
  }, [frames, spriteOptions, generateSpriteSheet]);

  // --- SIDEBAR ---
  const sidebarContent = (
    <div className="flex flex-col gap-6 pb-4">
      {/* 1. File Input */}
      <div className="flex flex-col gap-2">
        <FileDropzone onFilesSelected={handleFilesSelected} multiple={false} accept="video/*" label="Загрузить видео" />
      </div>

      {videoSrc && (
        <>
          {/* 2. Timeline */}
          {videoDuration && (
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-3">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Временной диапазон</div>
              <div className="px-1">
                <RangeSlider
                  min={0}
                  max={videoDuration}
                  step={0.01}
                  value={[extractionParams.startTime, effectiveEnd]}
                  onValueChange={([s, e]) => setExtractionParams(p => ({ ...p, startTime: s, endTime: e }))}
                  minStepsBetweenThumbs={0.1}
                />
              </div>
              <div className="flex justify-between text-xs text-zinc-600 font-mono">
                <span>{extractionParams.startTime.toFixed(2)}s</span>
                <span>{effectiveEnd.toFixed(2)}s</span>
              </div>
            </div>
          )}

          {/* 3. Settings */}
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 space-y-4">
            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Настройки</div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Шаг кадров (сек)</label>
              <input
                type="number" min="0.01" step="0.05"
                value={extractionParams.frameStep}
                onChange={(e) => setExtractionParams(p => ({ ...p, frameStep: parseFloat(e.target.value) }))}
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">FPS для GIF</label>
              <input
                type="number" min="1" max="60"
                value={gifParams.fps}
                onChange={(e) => setGifParams(p => ({ ...p, fps: parseFloat(e.target.value) }))}
                className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            <Switch
              label="Симметричный цикл"
              checked={extractionParams.symmetricLoop}
              onCheckedChange={(c) => setExtractionParams(p => ({ ...p, symmetricLoop: c }))}
            />
          </div>

          {/* 4. Main Action */}
          <div className="space-y-2">
            <button
              onClick={runExtraction}
              disabled={status.isProcessing}
              className="w-full rounded-md bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-all shadow-sm hover:shadow-md"
            >
              {status.isProcessing ? (status.currentStep === 'generating' ? 'Создание GIF...' : 'Обработка...') : (frames.length > 0 ? 'Обновить GIF' : 'Создать GIF и Кадры')}
            </button>
            {error && <div className="text-xs text-red-600 px-1">{error}</div>}
          </div>
        </>
      )}
    </div>
  );

  return (
    <ToolLayout title="Видео в Кадры/GIF" sidebar={sidebarContent}>
      <div className="relative w-full h-full flex flex-col bg-zinc-50/50 dark:bg-black/20 overflow-hidden">

        {!videoSrc ? (
          <div className="flex-1 p-8">
            <FileDropzonePlaceholder onUpload={handleFilesSelected} multiple={false} title="Перетащите видеофайл" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-6">

            {/* ROW 1: Video & GIF */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left: Video Player */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 shadow-sm aspect-video flex flex-col">
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Видео</h3>
                </div>
                <div className="flex-1 relative overflow-hidden bg-black rounded">
                  <RangeVideoPlayer
                    src={videoSrc}
                    startTime={extractionParams.startTime}
                    endTime={effectiveEnd}
                    className="absolute inset-0"
                  />
                </div>
              </div>

              {/* Right: GIF Preview */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 shadow-sm aspect-video flex flex-col">
                <div className="flex items-center justify-between mb-2 flex-shrink-0">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">GIF Результат</h3>
                  {gifParams.dataUrl && (
                    <button
                      onClick={() => { const a = document.createElement('a'); a.href = gifParams.dataUrl!; a.download = 'animation.gif'; a.click(); }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Скачать
                    </button>
                  )}
                </div>
                <div className="flex-1 relative overflow-hidden bg-zinc-100 dark:bg-zinc-950 rounded border border-dashed border-zinc-300 dark:border-zinc-800 flex items-center justify-center">
                  {gifParams.dataUrl ? (
                    <img src={gifParams.dataUrl} alt="GIF" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center p-4">
                      <p className="text-xs text-zinc-400">
                        {status.isProcessing ? "Генерация..." : "Здесь появится GIF"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ROW 2: Frame Diff & Sprite Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Diff Overlay */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 shadow-sm h-[220px]">
                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide mb-2">Разница (Старт vs Конец)</h3>
                <FrameDiffOverlay
                  image1={previewFrames.start}
                  image2={previewFrames.end}
                  isProcessing={isPreviewing}
                  label="Обновление превью..."
                />
              </div>

              {/* Sprite Sheet Preview - Controls inside */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 shadow-sm flex flex-col h-[220px]">
                <div className="flex items-center justify-between mb-3 flex-shrink-0 gap-2">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide whitespace-nowrap">Превью спрайт-листа</h3>
                  {/* In-component Controls */}
                  {frames.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-400">Высота:</span>
                        <input
                          type="number"
                          className="w-12 text-[10px] px-1 py-0.5 border rounded dark:bg-zinc-800 dark:border-zinc-600"
                          value={spriteOptions.maxHeight}
                          onChange={(e) => setSpriteOptions(p => ({ ...p, maxHeight: Number(e.target.value) }))}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-400">Отступ:</span>
                        <input
                          type="number"
                          className="w-10 text-[10px] px-1 py-0.5 border rounded dark:bg-zinc-800 dark:border-zinc-600"
                          value={spriteOptions.spacing}
                          onChange={(e) => setSpriteOptions(p => ({ ...p, spacing: Number(e.target.value) }))}
                        />
                      </div>
                      {spriteSheetUrl && (
                        <button
                          onClick={() => { const a = document.createElement('a'); a.href = spriteSheetUrl; a.download = 'spritesheet.png'; a.click(); }}
                          className="text-[10px] bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200 hover:bg-green-100 transition-colors"
                        >
                          Скачать
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 bg-zinc-100 dark:bg-zinc-950 rounded border border-dashed border-zinc-300 dark:border-zinc-800 relative overflow-x-auto overflow-y-hidden">
                  {spriteSheetUrl ? (
                    <div className="h-full flex items-center px-2">
                      <img src={spriteSheetUrl} alt="Sprite" className="h-4/5 w-auto max-w-none object-contain" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs text-zinc-400">{frames.length > 0 ? "Генерация..." : "Нет кадров"}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ROW 3: Frames List */}
            {frames.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Все кадры ({frames.length})</h3>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-600">
                  {frames.map((frame, idx) => (
                    <div key={idx} className="flex-shrink-0 w-32 border border-zinc-200 dark:border-zinc-700 rounded p-1 group relative bg-white dark:bg-zinc-800">
                      <img src={frame.dataUrl} className="w-full h-auto bg-black/5 rounded" alt={`f-${idx}`} />
                      <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
                        <span className="font-mono">{frame.time.toFixed(2)}s</span>
                        <span className="font-mono">#{idx + 1}</span>
                      </div>
                      <button
                        onClick={() => { const a = document.createElement('a'); a.href = frame.dataUrl; a.download = `frame-${idx}.png`; a.click(); }}
                        className="absolute top-2 right-2 p-1 bg-white/90 text-black rounded opacity-0 group-hover:opacity-100 shadow-sm transition-opacity"
                        title="Скачать кадр"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

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