
"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import gifshot from "gifshot";
import { Card } from "../../ui/Card";

interface ExtractedFrame {
  time: number;
  dataUrl: string;
}

interface GifshotResult {
  image?: string;
  error?: string;
}

// --- НОВАЯ ФУНКЦИЯ: Создание горизонтального PNG-спрайта ---
function useSpriteSheetGenerator() {
  const generateSpriteSheet = useCallback(async (frames: ExtractedFrame[], options?: {
    maxHeight?: number;
    spacing?: number;
    backgroundColor?: string;
  }) => {
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
    const backgroundColor = options?.backgroundColor || 'transparent';

    const scale = maxHeight / firstImage.height;
    const scaledWidth = Math.floor(firstImage.width * scale);
    const scaledHeight = maxHeight;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error("Не удалось создать контекст канваса");
    }

    canvas.width = (scaledWidth + spacing) * frames.length - spacing;
    canvas.height = scaledHeight;

    if (backgroundColor !== 'transparent') {
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
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.lineWidth = 1;
      for (let i = 1; i < frames.length; i++) {
        const x = i * (scaledWidth + spacing) - spacing / 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, scaledHeight);
        ctx.stroke();
      }
    }

    return canvas.toDataURL('image/png');
  }, []);

  return { generateSpriteSheet };
}

// --- НОВЫЙ КОМПОНЕНТ: Управление спрайт-листом ---
function SpriteSheetManager({ frames }: { frames: ExtractedFrame[] }) {
  const [spriteSheetUrl, setSpriteSheetUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [spriteOptions, setSpriteOptions] = useState({
    maxHeight: 500,
    spacing: 0,
    backgroundColor: 'transparent' as 'transparent' | 'white' | 'black',
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
      console.error('Ошибка при создании спрайт-листа:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadSpriteSheet = () => {
    if (!spriteSheetUrl) return;
    const a = document.createElement('a');
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
            onChange={(e) => setSpriteOptions(prev => ({ ...prev, maxHeight: parseInt(e.target.value) }))}
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
            onChange={(e) => setSpriteOptions(prev => ({ ...prev, spacing: parseInt(e.target.value) }))}
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
            onChange={(e) => setSpriteOptions(prev => ({ ...prev, backgroundColor: e.target.value as any }))}
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
          {isGenerating ? 'Создание...' : 'Создать спрайт-лист (PNG)'}
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

// --- ИЗМЕНЕННЫЙ КОМПОНЕНТ: Наложение кадров с сохранением изображения при загрузке ---
function FrameDiffOverlay({ frames, isExtracting }: { frames: ExtractedFrame[], isExtracting: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [overlayDataUrl, setOverlayDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Если кадров мало, мы НЕ очищаем overlayDataUrl сразу, 
    // чтобы сохранить старое изображение во время ре-экстракции.
    // Очистка произойдет только если мы попытаемся нарисовать, а кадров не будет.
    if (frames.length < 2) {
      return;
    }

    const processFrames = async () => {
      setIsProcessing(true);
      try {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;

        const firstImg = new Image();
        const lastImg = new Image();

        await Promise.all([
          new Promise<void>((resolve) => {
            firstImg.onload = () => resolve();
            firstImg.src = frames[0].dataUrl;
          }),
          new Promise<void>((resolve) => {
            lastImg.onload = () => resolve();
            lastImg.src = frames[frames.length - 1].dataUrl;
          })
        ]);

        canvas.width = firstImg.width;
        canvas.height = firstImg.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(firstImg, 0, 0);
        const firstImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        ctx.drawImage(lastImg, 0, 0);
        const lastImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const bgR = firstImageData.data[0];
        const bgG = firstImageData.data[1];
        const bgB = firstImageData.data[2];

        const resultImageData = ctx.createImageData(canvas.width, canvas.height);
        const threshold = 30;

        for (let i = 0; i < firstImageData.data.length; i += 4) {
          const firstR = firstImageData.data[i];
          const firstG = firstImageData.data[i + 1];
          const firstB = firstImageData.data[i + 2];

          const lastR = lastImageData.data[i];
          const lastG = lastImageData.data[i + 1];
          const lastB = lastImageData.data[i + 2];

          const firstIsBg = Math.abs(firstR - bgR) < threshold &&
            Math.abs(firstG - bgG) < threshold &&
            Math.abs(firstB - bgB) < threshold;

          const lastIsBg = Math.abs(lastR - bgR) < threshold &&
            Math.abs(lastG - bgG) < threshold &&
            Math.abs(lastB - bgB) < threshold;

          if (firstIsBg && lastIsBg) {
            resultImageData.data[i + 3] = 0;
          }
          else if (!firstIsBg && lastIsBg) {
            resultImageData.data[i] = 255;
            resultImageData.data[i + 1] = 0;
            resultImageData.data[i + 2] = 0;
            resultImageData.data[i + 3] = 200;
          }
          else if (firstIsBg && !lastIsBg) {
            resultImageData.data[i] = 0;
            resultImageData.data[i + 1] = 100;
            resultImageData.data[i + 2] = 255;
            resultImageData.data[i + 3] = 200;
          }
          else {
            resultImageData.data[i] = 200;
            resultImageData.data[i + 1] = 50;
            resultImageData.data[i + 2] = 255;
            resultImageData.data[i + 3] = 220;
          }
        }

        ctx.putImageData(resultImageData, 0, 0);
        setOverlayDataUrl(canvas.toDataURL('image/png'));
      } catch (error) {
        console.error('Error processing frames:', error);
      } finally {
        setIsProcessing(false);
      }
    };

    processFrames();
  }, [frames]);

  // Определяем, нужно ли показывать лоадер
  // Показываем если идет внутренняя обработка ИЛИ внешнее извлечение кадров
  const isLoading = isProcessing || isExtracting;

  // Если нет данных и мы не грузим ничего - показываем заглушку или ничего
  if (frames.length < 2 && !overlayDataUrl && !isLoading) {
    return null;
  }

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800 min-h-[200px] flex items-center justify-center">

        {/* Изображение (если есть) */}
        {overlayDataUrl && (
          <img
            src={overlayDataUrl}
            alt="Frame difference overlay"
            className="w-full object-contain transition-opacity duration-300"
            style={{ maxHeight: '300px' }}
          />
        )}

        {/* Оверлей загрузки (поверх изображения или вместо него) */}
        {isLoading && (
          <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center 
            ${overlayDataUrl ? 'bg-white/60 dark:bg-black/60 backdrop-blur-[2px]' : 'bg-transparent'}`}>
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-600"></div>
            <p className="mt-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {isExtracting ? 'Извлечение кадров...' : 'Обработка разницы...'}
            </p>
          </div>
        )}

        {/* Состояние "пусто" (только при первом запуске до генерации) */}
        {!overlayDataUrl && !isLoading && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Извлеките минимум 2 кадра для отображения наложения
          </p>
        )}
      </div>

      {overlayDataUrl && (
        <>
          <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-red-600"></div>
              <span>Только в первом кадре ({frames[0]?.time.toFixed(1) ?? '?'}s)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-blue-600"></div>
              <span>Только в последнем кадре ({frames[frames.length - 1]?.time.toFixed(1) ?? '?'}s)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-purple-600"></div>
              <span>В обоих кадрах</span>
            </div>
            <p className="mt-2 text-[10px]">
              Фон определяется по цвету левого верхнего пикселя
            </p>
          </div>
          <button
            onClick={() => {
              if (!overlayDataUrl) return;
              const a = document.createElement('a');
              a.href = overlayDataUrl;
              a.download = 'frame-diff-overlay.png';
              a.click();
            }}
            className="rounded-md border border-blue-600 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-950/30"
          >
            Скачать наложение
          </button>
        </>
      )}
    </div>
  );
}

function RangeVideoPlayer({
  src,
  startTime,
  endTime,
}: {
  src: string | null;
  startTime: number;
  endTime: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);

  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - startTime) > 0.5) {
      videoRef.current.currentTime = startTime;
      setCurrentTime(startTime);
    }
  }, [startTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);

      if (time >= endTime) {
        video.currentTime = startTime;
        if (isPlaying) video.play().catch(() => { });
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [endTime, startTime, isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      if (videoRef.current.currentTime >= endTime) {
        videoRef.current.currentTime = startTime;
      }
      videoRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const duration = endTime - startTime;
  const progress = duration > 0 ? ((currentTime - startTime) / duration) * 100 : 0;
  const progressSafe = Math.max(0, Math.min(100, progress));

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const elapsedTime = Math.max(0, currentTime - startTime);
  const remainingTime = Math.max(0, endTime - currentTime);

  if (!src) return null;

  return (
    <div className="space-y-2 mb-4">
      <div className="relative overflow-hidden rounded-md bg-black aspect-video">
        <video
          ref={videoRef}
          src={src}
          className="h-full w-full object-contain"
          muted
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 hover:opacity-100 transition-opacity group">
          <button
            onClick={togglePlay}
            className="rounded-full bg-white/90 p-3 text-black shadow-lg hover:bg-white hover:scale-110 transition-all"
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg className="w-6 h-6 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
        </div>

        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full bg-black/50 p-3 text-white backdrop-blur-sm">
              <svg className="w-8 h-8 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        )}

        <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm rounded px-2 py-1 text-xs text-white font-mono">
          {formatTime(elapsedTime)} / {formatTime(duration)}
        </div>
      </div>

      <div className="space-y-1">
        <div className="relative h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-blue-600 transition-all duration-100 ease-linear"
            style={{ width: `${progressSafe}%` }}
          />

          <button
            className="absolute inset-0 cursor-pointer"
            onClick={(e) => {
              if (!videoRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = x / rect.width;
              const newTime = startTime + (duration * percentage);
              videoRef.current.currentTime = Math.max(startTime, Math.min(endTime, newTime));
            }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-mono">{formatTime(elapsedTime)}</span>
            <span className="text-zinc-400 dark:text-zinc-600">•</span>
            <span>Позиция: {currentTime.toFixed(2)}s</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Осталось: {formatTime(remainingTime)}</span>
            <span className="text-zinc-400 dark:text-zinc-600">•</span>
            <span className="font-mono">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function VideoFrameExtractor() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const [extractionParams, setExtractionParams] = useState({
    startTime: 0,
    endTime: 0,
    frameStep: 1,
  });

  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [gifParams, setGifParams] = useState({
    fps: 5,
    dataUrl: null as string | null,
  });

  const [status, setStatus] = useState({
    isProcessing: false,
    currentStep: "" as "extracting" | "generating" | "",
  });

  const [errors, setErrors] = useState({
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
    setGifParams(prev => ({ ...prev, dataUrl: null }));
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

    setStatus({ isProcessing: true, currentStep: "extracting" });
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

      setFrames(resultFrames);

      if (resultFrames.length === 0) {
        throw new Error("Не удалось извлечь кадры");
      }

      if (gifParams.fps <= 0) {
        throw new Error("Скорость GIF должна быть > 0");
      }

      setStatus({ isProcessing: true, currentStep: "generating" });

      const gifDataUrl = await new Promise<string>((resolve, reject) => {
        const intervalSeconds = 1 / gifParams.fps;

        gifshot.createGIF(
          {
            images: resultFrames.map(f => f.dataUrl),
            interval: intervalSeconds,
            gifWidth: canvasEl.width,
            gifHeight: canvasEl.height,
            numFrames: resultFrames.length,
          },
          (result) => {
            if (result?.error) {
              reject(new Error(String(result.error) || "Не удалось создать GIF"));
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

      if (status.currentStep === "extracting") {
        setErrors(prev => ({ ...prev, extraction: errorMessage }));
      } else {
        setErrors(prev => ({ ...prev, gif: errorMessage }));
      }
    } finally {
      setStatus({ isProcessing: false, currentStep: "" });
    }
  }, [videoFile, extractionParams, effectiveEnd, gifParams.fps, status.currentStep, videoSrc]);

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

  const handleTimeChange = useCallback((type: 'start' | 'end', value: number) => {
    if (!videoDuration) return;

    const updates = type === 'start'
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

  // Условие для отображения оверлея:
  // Либо у нас уже есть кадры,
  // ЛИБО идет процесс извлечения (status.isProcessing && status.currentStep === 'extracting')
  // Это предотвращает исчезновение компонента при повторном нажатии кнопки, когда frames=[]
  const showDiffOverlay = frames.length >= 2 || (status.isProcessing && status.currentStep === 'extracting');

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

            <TimeRangeSlider
              startTime={extractionParams.startTime}
              endTime={effectiveEnd}
              duration={videoDuration}
              onTimeChange={handleTimeChange}
            />

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

            {errors.extraction && <ErrorMessage message={errors.extraction} />}
            {errors.gif && <ErrorMessage message={errors.gif} />}

            <div className="space-y-2">
              <button
                onClick={extractFramesAndGenerateGif}
                disabled={status.isProcessing || !videoFile}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {getButtonText()}
              </button>
            </div>
          </div>
        </Card>
      </div>


      {/* СЕКЦИЯ: Разница кадров (Обновленная логика показа) */}
      {showDiffOverlay && (
        <Card>
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Анализ изменений между кадрами
            </h3>
            {/* Передаем флаг isExtracting для отображения лоадера поверх старого изображения */}
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

// --- Вспомогательные компоненты ---

function FileInput({ onChange }: { onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
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

function TimeRangeSlider({
  startTime,
  endTime,
  duration,
  onTimeChange
}: {
  startTime: number;
  endTime: number;
  duration: number | null;
  onTimeChange: (type: 'start' | 'end', value: number) => void;
}) {
  if (!duration || duration <= 0) return null;

  const startPercent = (startTime / duration) * 100;
  const endPercent = (endTime / duration) * 100;

  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
        <span>Диапазон (сек)</span>
        <span>{startTime.toFixed(1)}s – {endTime.toFixed(1)}s</span>
      </div>

      <div className="relative h-8">
        <div className="absolute inset-y-3 left-0 right-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />

        {startTime < endTime && (
          <div
            className="absolute inset-y-3 rounded-full bg-blue-500/50"
            style={{
              left: `${startPercent}%`,
              right: `${100 - endPercent}%`,
            }}
          />
        )}

        <input
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={startTime}
          onChange={(e) => onTimeChange('start', Number(e.target.value))}
          className="range-dual absolute inset-x-0 top-0 z-20 w-full"
        />

        <input
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={endTime}
          onChange={(e) => onTimeChange('end', Number(e.target.value))}
          className="range-dual absolute inset-x-0 bottom-0 z-10 w-full"
        />
      </div>

      <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
        <span>0s</span>
        <span>{duration.toFixed(1)}s</span>
      </div>
    </div>
  );
}

function NumberInput({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
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

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
      {message}
    </div>
  );
}

function FrameItem({
  frame,
  index,
  onDownload
}: {
  frame: ExtractedFrame;
  index: number;
  onDownload: () => void;
}) {
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