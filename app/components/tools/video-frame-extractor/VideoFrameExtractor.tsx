"use client";

import { Card } from "../../ui/Card";
import { RangeVideoPlayer } from "./RangeVideoPlayer";
import { FrameDiffOverlay } from "./FrameDiffOverlay";
import { TimeRangeSlider } from "./TimeRangeSlider";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import gifshot from "gifshot";

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

export interface ExtractionErrors {
  extraction: string;
  gif: string;
}

interface ErrorMessageProps {
  message: string;
}

function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
      {message}
    </div>
  );
}

interface NumberInputProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

function NumberInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: NumberInputProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />
    </div>
  );
}

interface FileInputProps {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function FileInput({ onChange }: FileInputProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Видео файл
      </label>
      <input
        type="file"
        accept="video/*"
        onChange={onChange}
        className="block w-full text-sm text-zinc-900 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 dark:text-zinc-100"
      />
    </div>
  );
}

// --- FEATURE COMPONENTS ---

interface FrameItemProps {
  frame: ExtractedFrame;
  index: number;
  onDownload: () => void;
}

function FrameItem({ frame, index, onDownload }: FrameItemProps) {
  return (
    <div className="flex h-full w-40 flex-shrink-0 flex-col justify-between rounded-md border border-zinc-200 p-2 dark:border-zinc-700">
      <img
        src={frame.dataUrl}
        alt={`Кадр ${index + 1}`}
        className="w-full flex-1 rounded-md object-contain bg-zinc-100 dark:bg-zinc-800"
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
        <span>{frame.time.toFixed(2)}s</span>
        <button
          onClick={onDownload}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Скачать
        </button>
      </div>
    </div>
  );
}

// --- SPRITE SHEET LOGIC & COMPONENT ---

function useSpriteSheetGenerator() {
  const generateSpriteSheet = useCallback(
    async (
      frames: ExtractedFrame[],
      options?: {
        maxHeight?: number;
        spacing?: number;
        backgroundColor?: string;
      }
    ) => {
      if (frames.length === 0) {
        throw new Error("Нет кадров для создания спрайт-листа");
      }

      const firstImage = new Image();
      await new Promise<void>((resolve) => {
        firstImage.onload = () => resolve();
        firstImage.src = frames[0].dataUrl;
      });

      const maxHeight = options?.maxHeight ?? 500;
      const spacing = options?.spacing ?? 0;
      const backgroundColor = options?.backgroundColor || "transparent";

      const scale = maxHeight / firstImage.height;
      const scaledWidth = Math.floor(firstImage.width * scale);
      const scaledHeight = maxHeight;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Не удалось создать контекст канваса");
      }

      canvas.width = (scaledWidth + spacing) * frames.length - spacing;
      canvas.height = scaledHeight;

      if (backgroundColor !== "transparent") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      for (let i = 0; i < frames.length; i++) {
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.src = frames[i].dataUrl;
        });

        const x = i * (scaledWidth + spacing);
        ctx.drawImage(img, x, 0, scaledWidth, scaledHeight);
      }

      if (spacing > 0) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
        ctx.lineWidth = 1;
        for (let i = 1; i < frames.length; i++) {
          const x = i * (scaledWidth + spacing) - spacing / 2;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, scaledHeight);
          ctx.stroke();
        }
      }

      return canvas.toDataURL("image/png");
    },
    []
  );

  return { generateSpriteSheet };
}

interface SpriteSheetManagerProps {
  frames: ExtractedFrame[];
}

function SpriteSheetManager({ frames }: SpriteSheetManagerProps) {
  const [spriteSheetUrl, setSpriteSheetUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [spriteOptions, setSpriteOptions] = useState({
    maxHeight: 500,
    spacing: 0,
    backgroundColor: "transparent" as "transparent" | "white" | "black",
  });

  const { generateSpriteSheet } = useSpriteSheetGenerator();

  const handleGenerateSpriteSheet = async () => {
    if (frames.length === 0) return;

    setIsGenerating(true);
    try {
      const dataUrl = await generateSpriteSheet(frames, {
        maxHeight: spriteOptions.maxHeight,
        spacing: spriteOptions.spacing,
        backgroundColor: spriteOptions.backgroundColor,
      });
      setSpriteSheetUrl(dataUrl);
    } catch (error) {
      console.error("Ошибка при создании спрайт-листа:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadSpriteSheet = () => {
    if (!spriteSheetUrl) return;
    const a = document.createElement("a");
    a.href = spriteSheetUrl;
    a.download = `sprite-sheet-${frames.length}-frames.png`;
    a.click();
  };

  if (frames.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Макс. высота (пикс)
          </label>
          <input
            type="range"
            min="50"
            max="500"
            step="10"
            value={spriteOptions.maxHeight}
            onChange={(e) =>
              setSpriteOptions((prev) => ({ ...prev, maxHeight: parseInt(e.target.value) }))
            }
            className="w-full"
          />
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            {spriteOptions.maxHeight}px
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Отступ между кадрами
          </label>
          <input
            type="range"
            min="0"
            max="20"
            step="1"
            value={spriteOptions.spacing}
            onChange={(e) =>
              setSpriteOptions((prev) => ({ ...prev, spacing: parseInt(e.target.value) }))
            }
            className="w-full"
          />
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            {spriteOptions.spacing}px
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Фон
          </label>
          <select
            value={spriteOptions.backgroundColor}
            onChange={(e) =>
              setSpriteOptions((prev) => ({
                ...prev,
                backgroundColor: e.target.value as "transparent" | "white" | "black",
              }))
            }
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="transparent">Прозрачный</option>
            <option value="white">Белый</option>
            <option value="black">Черный</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleGenerateSpriteSheet}
          disabled={isGenerating || frames.length === 0}
          className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? "Создание..." : "Создать спрайт-лист (PNG)"}
        </button>

        {spriteSheetUrl && (
          <button
            onClick={downloadSpriteSheet}
            className="flex-1 rounded-md border border-green-600 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-50 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-950/30"
          >
            Скачать спрайт-лист
          </button>
        )}
      </div>

      {spriteSheetUrl && (
        <div className="mt-4">
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="bg-zinc-50 dark:bg-zinc-800 p-2 text-xs text-zinc-600 dark:text-zinc-400">
              Предпросмотр спрайт-листа ({frames.length} кадров)
            </div>
            <div className="p-4 bg-zinc-100 dark:bg-zinc-900 overflow-x-auto">
              <img
                src={spriteSheetUrl}
                alt="Sprite sheet preview"
                className="max-w-full h-auto border border-zinc-300 dark:border-zinc-700"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// --- MAIN HOOK LOGIC ---

function useVideoFrameExtraction() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const [extractionParams, setExtractionParams] = useState<ExtractionParams>({
    startTime: 0,
    endTime: 0,
    frameStep: 1,
    symmetricLoop: false,
  });

  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [gifParams, setGifParams] = useState<GifParams>({
    fps: 5,
    dataUrl: null,
  });

  const [status, setStatus] = useState<ExtractionStatus>({
    isProcessing: false,
    currentStep: "",
  });

  const [errors, setErrors] = useState<ExtractionErrors>({
    extraction: "",
    gif: "",
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const effectiveEnd = useMemo(
    () => (extractionParams.endTime > 0 ? extractionParams.endTime : videoDuration ?? 0),
    [extractionParams.endTime, videoDuration]
  );

  const frameCount = frames.length;

  useEffect(() => {
    return () => {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
    };
  }, [videoSrc]);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;

    setVideoFile(file);
    setFrames([]);
    setErrors({ extraction: "", gif: "" });
    setGifParams((prev) => ({ ...prev, dataUrl: null }));
    setVideoDuration(null);
    setExtractionParams(prev => ({ ...prev, startTime: 0, endTime: 0 }));

    if (videoSrc) URL.revokeObjectURL(videoSrc);
    setVideoSrc(null);

    if (!file || !videoRef.current) return;

    const objectUrl = URL.createObjectURL(file);
    setVideoSrc(objectUrl);

    const videoEl = videoRef.current;
    videoEl.src = objectUrl;

    try {
      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          const duration = videoEl.duration || 0;
          setVideoDuration(duration);

          const defaultStep = Math.max(0.5, duration / 10);
          setExtractionParams(prev => ({
            ...prev,
            endTime: duration,
            frameStep: Number(defaultStep.toFixed(2)),
          }));

          resolve();
        };

        videoEl.addEventListener("loadedmetadata", onLoaded, { once: true });
        videoEl.addEventListener("error", () => reject(new Error("Ошибка загрузки видео")), { once: true });
      });
    } catch (err) {
      setErrors(prev => ({
        ...prev,
        extraction: err instanceof Error ? err.message : "Ошибка загрузки видео",
      }));
    }
  }, [videoSrc]);

  const extractFramesAndGenerateGif = useCallback(async () => {
    if (!videoFile || !videoRef.current || !canvasRef.current) {
      setErrors(prev => ({ ...prev, extraction: "Необходимо выбрать видеофайл" }));
      return;
    }

    if (extractionParams.frameStep <= 0) {
      setErrors(prev => ({ ...prev, extraction: "Шаг между кадрами должен быть > 0" }));
      return;
    }

    const videoEl = videoRef.current;
    const canvasEl = canvasRef.current;

    if (!videoEl.src && videoSrc) {
      videoEl.src = videoSrc;
    }

    const currentStep: ExtractionStep = "extracting";
    setStatus({ isProcessing: true, currentStep });
    setErrors({ extraction: "", gif: "" });
    setFrames([]);
    setGifParams(prev => ({ ...prev, dataUrl: null }));

    try {
      if (videoEl.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          videoEl.addEventListener("loadedmetadata", () => resolve(), { once: true });
          videoEl.addEventListener("error", () => reject(new Error("Не удалось загрузить видео")), { once: true });
        });
      }

      const duration = videoEl.duration;
      const safeStart = Math.max(0, extractionParams.startTime);
      const safeEnd = Math.min(effectiveEnd, duration);

      if (safeStart >= safeEnd) {
        throw new Error("Начальное время должно быть меньше конечного");
      }

      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
      const ctx = canvasEl.getContext("2d");
      if (!ctx) throw new Error("Не удалось инициализировать канвас");

      const resultFrames: ExtractedFrame[] = [];
      const interval = extractionParams.frameStep;

      for (let current = safeStart; current <= safeEnd; current += interval) {
        await new Promise<void>((resolve) => {
          const onSeeked = () => {
            ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
            resultFrames.push({
              time: current,
              dataUrl: canvasEl.toDataURL("image/png"),
            });
            resolve();
          };

          videoEl.currentTime = current;
          const timeout = setTimeout(() => {
            resolve();
          }, 1000);

          videoEl.addEventListener("seeked", () => {
            clearTimeout(timeout);
            onSeeked();
          }, { once: true });
        });
      }

      let finalFrames: ExtractedFrame[] = resultFrames;

      if (extractionParams.symmetricLoop && resultFrames.length > 1) {
        const backward = resultFrames.slice(1, -1).reverse();
        finalFrames = [...resultFrames, ...backward];
      }

      setFrames(finalFrames);

      if (finalFrames.length === 0) {
        throw new Error("Не удалось извлечь кадры");
      }

      if (gifParams.fps <= 0) {
        throw new Error("Скорость GIF должна быть > 0");
      }

      setStatus({ isProcessing: true, currentStep: "generating" });

      const gifDataUrl = await new Promise<string>((resolve, reject) => {
        const intervalSeconds = 1 / gifParams.fps;

        // Ensure gifshot is imported and available
        if (typeof gifshot === 'undefined') {
          reject(new Error("Библиотека gifshot не найдена"));
          return;
        }

        gifshot.createGIF(
          {
            images: finalFrames.map(f => f.dataUrl),
            interval: intervalSeconds,
            gifWidth: canvasEl.width,
            gifHeight: canvasEl.height,
            numFrames: finalFrames.length,
          },
          (result: any) => {
            if (result && result.error) {
              const message = String(result.error) || "Не удалось создать GIF";
              reject(new Error(message));
              return;
            }

            if (result?.image) {
              resolve(result.image);
            } else {
              reject(new Error("GIF создан, но данные отсутствуют"));
            }
          }
        );
      });

      setGifParams(prev => ({ ...prev, dataUrl: gifDataUrl }));
      setErrors({ extraction: "", gif: "" });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Произошла ошибка";

      if (currentStep === "extracting") {
        setErrors(prev => ({ ...prev, extraction: errorMessage }));
      } else {
        setErrors(prev => ({ ...prev, gif: errorMessage }));
      }
    } finally {
      setStatus({ isProcessing: false, currentStep: "" });
    }
  }, [videoFile, extractionParams, effectiveEnd, gifParams.fps, videoSrc]);

  const downloadFrame = useCallback((frame: ExtractedFrame, index: number) => {
    const a = document.createElement("a");
    a.href = frame.dataUrl;
    a.download = `frame-${index + 1}-${frame.time.toFixed(2).replace(".", "-")}s.png`;
    a.click();
  }, []);

  const downloadGif = useCallback(() => {
    if (!gifParams.dataUrl) return;
    const a = document.createElement("a");
    a.href = gifParams.dataUrl;
    a.download = "frames.gif";
    a.click();
  }, [gifParams.dataUrl]);

  const handleTimeChange = useCallback((type: "start" | "end", value: number) => {
    if (!videoDuration) return;

    const updates =
      type === "start"
        ? { startTime: Math.max(0, Math.min(value, effectiveEnd - 0.01)) }
        : { endTime: Math.min(videoDuration, Math.max(value, extractionParams.startTime + 0.01)) };

    setExtractionParams(prev => ({ ...prev, ...updates }));
  }, [videoDuration, effectiveEnd, extractionParams.startTime]);

  const getButtonText = () => {
    if (status.isProcessing) {
      return status.currentStep === "extracting"
        ? "Извлечение кадров..."
        : "Создание GIF...";
    }
    return frames.length > 0
      ? "Обновить кадры и GIF"
      : "Извлечь кадры и создать GIF";
  };

  const showDiffOverlay = frames.length >= 2 || (status.isProcessing && status.currentStep === "extracting");

  return {
    videoRef,
    canvasRef,
    videoSrc,
    videoDuration,
    extractionParams,
    frames,
    gifParams,
    status,
    errors,
    effectiveEnd,
    frameCount,
    showDiffOverlay,
    handleFileChange,
    extractFramesAndGenerateGif,
    downloadFrame,
    downloadGif,
    handleTimeChange,
    setExtractionParams,
    setGifParams,
    getButtonText,
  };
}

// --- MAIN COMPONENT ---

export function VideoFrameExtractor() {
  const {
    videoRef,
    canvasRef,
    videoSrc,
    videoDuration,
    extractionParams,
    frames,
    gifParams,
    status,
    errors,
    effectiveEnd,
    frameCount,
    showDiffOverlay,
    handleFileChange,
    extractFramesAndGenerateGif,
    downloadFrame,
    downloadGif,
    handleTimeChange,
    setExtractionParams,
    setGifParams,
    getButtonText,
  } = useVideoFrameExtraction();

  return (
    <div className="flex min-h-[80vh] flex-col space-y-6">
      <div className="space-y-6">
        <Card>
          <div className="space-y-4">
            <FileInput onChange={handleFileChange} />

            {videoSrc && (
              <div className="grid gap-4 md:grid-cols-2 items-start">
                <RangeVideoPlayer
                  src={videoSrc}
                  startTime={extractionParams.startTime}
                  endTime={effectiveEnd}
                />

                <div className="space-y-2">
                  <div className="relative overflow-hidden rounded-md bg-black aspect-video flex items-center justify-center">
                    {gifParams.dataUrl ? (
                      <img
                        src={gifParams.dataUrl}
                        alt="GIF preview"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <p className="px-3 text-center text-xs text-zinc-400">
                        {status.isProcessing
                          ? (status.currentStep === "generating"
                            ? "Создание GIF..."
                            : "Обработка...")
                          : "GIF появится здесь после генерации."}
                      </p>
                    )}
                  </div>

                  {gifParams.dataUrl && (
                    <button
                      onClick={downloadGif}
                      className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Скачать GIF
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Заменили класс "no-select" на стандартный Tailwind класс */}
            <div className="select-none">
              <TimeRangeSlider
                startTime={extractionParams.startTime}
                endTime={effectiveEnd}
                duration={videoDuration}
                onTimeChange={handleTimeChange}
              />
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <NumberInput
                  label="Шаг между кадрами (сек)"
                  value={extractionParams.frameStep}
                  min={0.01}
                  step={0.01}
                  onChange={(value) => setExtractionParams(prev => ({ ...prev, frameStep: value }))}
                />
                <NumberInput
                  label="Скорость GIF (кадров/сек)"
                  value={gifParams.fps}
                  min={0.5}
                  max={30}
                  step={0.5}
                  onChange={(fps) => setGifParams(prev => ({ ...prev, fps }))}
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={extractionParams.symmetricLoop}
                  onChange={(e) =>
                    setExtractionParams(prev => ({ ...prev, symmetricLoop: e.target.checked }))
                  }
                  className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600"
                />
                <span>
                  Симметричный набор кадров для точного зацикливания (туда-обратно)
                </span>
              </label>
            </div>

            {errors.extraction && <ErrorMessage message={errors.extraction} />}
            {errors.gif && <ErrorMessage message={errors.gif} />}

            <div className="space-y-2">
              <button
                onClick={extractFramesAndGenerateGif}
                disabled={status.isProcessing || !videoSrc}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {getButtonText()}
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* СЕКЦИЯ: Разница кадров */}
      {showDiffOverlay && (
        <Card>
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Анализ изменений между кадрами
            </h3>
            <FrameDiffOverlay
              frames={frames}
              isExtracting={status.isProcessing && status.currentStep === 'extracting'}
            />
          </div>
        </Card>
      )}

      {/* Список кадров */}
      <Card className="flex min-h-[220px] flex-1 flex-col gap-4">
        <div className="flex flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Извлечённые кадры ({frameCount})
            </h3>
          </div>

          {frames.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {status.isProcessing && status.currentStep === "extracting"
                ? "Извлечение кадров..."
                : "Кадры появятся здесь после извлечения."}
            </p>
          ) : (
            <div className="flex h-full items-stretch gap-3 overflow-x-auto overflow-y-hidden pr-1 pb-1">
              {frames.map((frame, index) => (
                <FrameItem
                  key={index}
                  frame={frame}
                  index={index}
                  onDownload={() => downloadFrame(frame, index)}
                />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Спрайт-лист */}
      {frames.length > 0 && (
        <Card>
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Спрайт-лист для анимации (PNG)
            </h3>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Создайте горизонтальное изображение со всеми кадрами для использования в игровых движках или CSS-анимациях
            </p>
            <SpriteSheetManager frames={frames} />
          </div>
        </Card>
      )}

      <video ref={videoRef} className="hidden" crossOrigin="anonymous" />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}