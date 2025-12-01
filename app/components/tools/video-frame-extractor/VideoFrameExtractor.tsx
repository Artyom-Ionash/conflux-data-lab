"use client";

// @ts-ignore – gifshot не имеет встроенных типов
import gifshot from "gifshot";
import { useState, useRef, useEffect } from "react";
import { Card } from "../../ui/Card";

interface ExtractedFrame {
  time: number;
  dataUrl: string;
}

export function VideoFrameExtractor() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState<number | "">("");
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [frameStep, setFrameStep] = useState(1); // шаг между кадрами, сек
  const [frames, setFrames] = useState<ExtractedFrame[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingGif, setIsGeneratingGif] = useState(false);
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [error, setError] = useState("");
  const [gifError, setGifError] = useState("");
  const [gifDataUrl, setGifDataUrl] = useState<string | null>(null);
  const [gifFps, setGifFps] = useState(5);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setVideoFile(file);
    setFrames([]);
    setError("");
    setGifError("");
    setGifDataUrl(null);
    setVideoDuration(null);
    setStartTime(0);
    setEndTime("");

    if (file && videoRef.current) {
      const videoEl = videoRef.current;
      const objectUrl = URL.createObjectURL(file);
      videoEl.src = objectUrl;

      const onLoadedMetadata = () => {
        const duration = videoEl.duration || 0;
        setVideoDuration(duration || null);

        // По умолчанию делим диапазон на ~10 кадров
        if (duration > 0) {
          const step = duration / 10;
          // Не даём шагу быть слишком маленьким
          setFrameStep(Number(step.toFixed(2)) || 1);
        }

        URL.revokeObjectURL(objectUrl);

        // При включённом автообновлении запускаем извлечение кадров и GIF
        if (autoGenerate) {
          void extractFrames();
        }
      };

      const onError = () => {
        URL.revokeObjectURL(objectUrl);
      };

      videoEl.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
      videoEl.addEventListener("error", onError, { once: true });
    }
  };

  const extractFrames = async () => {
    try {
      setError("");
      setFrames([]);

      if (!videoFile) {
        setError("Пожалуйста, выберите видеофайл.");
        return;
      }

      if (frameStep <= 0) {
        setError("Шаг между кадрами должен быть больше 0.");
        return;
      }

      const videoEl = videoRef.current;
      const canvasEl = canvasRef.current;

      if (!videoEl || !canvasEl) {
        setError("Внутренняя ошибка: видео или канвас недоступны.");
        return;
      }

      const objectUrl = URL.createObjectURL(videoFile);
      videoEl.src = objectUrl;

      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          resolve();
        };
        const onError = () => {
          reject(new Error("Не удалось загрузить видео."));
        };

        videoEl.addEventListener("loadedmetadata", onLoaded, { once: true });
        videoEl.addEventListener("error", onError, { once: true });
      });

      const duration = videoEl.duration;
      const safeStart = Math.max(0, startTime);
      const safeEnd = Math.min(
        endTime === "" ? duration : endTime,
        duration
      );

      if (safeStart >= safeEnd) {
        setError("Начальное время должно быть меньше конечного.");
        URL.revokeObjectURL(objectUrl);
        return;
      }

      const interval = frameStep;
      const resultFrames: ExtractedFrame[] = [];

      canvasEl.width = videoEl.videoWidth;
      canvasEl.height = videoEl.videoHeight;
      const ctx = canvasEl.getContext("2d");

      if (!ctx) {
        setError("Не удалось инициализировать канвас.");
        URL.revokeObjectURL(objectUrl);
        return;
      }

      setIsProcessing(true);

      for (let current = safeStart; current <= safeEnd; current += interval) {
        await new Promise<void>((resolve, reject) => {
          const onSeeked = () => {
            try {
              ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
              const dataUrl = canvasEl.toDataURL("image/png");
              resultFrames.push({ time: current, dataUrl });
              resolve();
            } catch (e) {
              reject(e);
            }
          };

          videoEl.currentTime = current;
          videoEl.addEventListener("seeked", onSeeked, { once: true });
        });
      }

      setFrames(resultFrames);
      if (autoGenerate) {
        // Автоматически обновляем GIF после пересчёта кадров
        generateGif();
      }
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Произошла ошибка при извлечении кадров."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = (frame: ExtractedFrame, index: number) => {
    const a = document.createElement("a");
    a.href = frame.dataUrl;
    const timeLabel = frame.time.toFixed(2).replace(".", "-");
    a.download = `frame-${index + 1}-${timeLabel}s.png`;
    a.click();
  };

  const effectiveEnd =
    typeof endTime === "number"
      ? endTime
      : videoDuration ?? 0;

  const generateGif = () => {
    try {
      setGifError("");
      setGifDataUrl(null);

      if (frames.length === 0) {
        setGifError("Сначала извлеките кадры из видео.");
        return;
      }

      if (gifFps <= 0) {
        setGifError("Скорость GIF должна быть больше 0.");
        return;
      }

      setIsGeneratingGif(true);

      const intervalSeconds = 1 / gifFps;

      gifshot.createGIF(
        {
          images: frames.map((f) => f.dataUrl),
          interval: intervalSeconds,
          gifWidth: canvasRef.current?.width || undefined,
          gifHeight: canvasRef.current?.height || undefined,
          numFrames: frames.length,
          progressCallback: () => {},
        },
        (obj: any) => {
          setIsGeneratingGif(false);

          if (!obj || obj.error) {
            setGifError(
              obj && obj.error
                ? String(obj.error)
                : "Не удалось создать GIF."
            );
            return;
          }

          if (obj.image) {
            setGifDataUrl(obj.image as string);
          } else {
            setGifError("GIF создан, но данные изображения отсутствуют.");
          }
        }
      );
    } catch (err) {
      console.error(err);
      setIsGeneratingGif(false);
      setGifError(
        err instanceof Error ? err.message : "Ошибка при создании GIF."
      );
    }
  };

  return (
    <div className="flex min-h-[80vh] flex-col space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Input / Controls (left) */}
        <Card>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-900 dark:text-zinc-100">
                Видео файл
              </label>
              <input
                type="file"
                accept="video/*"
                onChange={handleFileChange}
                className="block w-full text-sm text-zinc-900 file:mr-4 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-blue-700 dark:text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  <span>Диапазон (сек)</span>
                  <span>
                    {startTime.toFixed(1)}s{" "}
                    {videoDuration !== null && effectiveEnd > 0
                      ? `– ${effectiveEnd.toFixed(1)}s`
                      : ""}
                  </span>
                </div>
                <div className="relative h-8">
                  {/* Общий трек */}
                  <div className="absolute inset-y-3 left-0 right-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />
                  {/* Подсветка выбранного диапазона */}
                  {videoDuration && videoDuration > 0 && effectiveEnd > startTime && (
                    <div
                      className="absolute inset-y-3 rounded-full bg-blue-500/50"
                      style={{
                        left: `${(startTime / videoDuration) * 100}%`,
                        right: `${100 - (effectiveEnd / videoDuration) * 100}%`,
                      }}
                    />
                  )}
                  {/* Левый курсор (начало) */}
                  <input
                    type="range"
                    min={0}
                    max={videoDuration ?? 0}
                    step={0.1}
                    value={startTime}
                    disabled={!videoDuration}
                    onChange={(e) => {
                      if (!videoDuration) return;
                      const raw = Number(e.target.value);
                      const maxStart = effectiveEnd - 0.1;
                      const next = Math.max(0, Math.min(raw, maxStart > 0 ? maxStart : 0));
                      setStartTime(next);
                    }}
                    onMouseUp={() => {
                      if (autoGenerate) void extractFrames();
                    }}
                    onTouchEnd={() => {
                      if (autoGenerate) void extractFrames();
                    }}
                    className="range-dual absolute inset-x-0 top-0 z-20 w-full"
                  />
                  {/* Правый курсор (конец) */}
                  <input
                    type="range"
                    min={0}
                    max={videoDuration ?? 0}
                    step={0.1}
                    value={effectiveEnd}
                    disabled={!videoDuration}
                    onChange={(e) => {
                      if (!videoDuration) return;
                      const raw = Number(e.target.value);
                      const minEnd = startTime + 0.1;
                      const next = Math.min(
                        videoDuration,
                        Math.max(raw, minEnd <= videoDuration ? minEnd : videoDuration)
                      );
                      setEndTime(next);
                    }}
                    onMouseUp={() => {
                      if (autoGenerate) void extractFrames();
                    }}
                    onTouchEnd={() => {
                      if (autoGenerate) void extractFrames();
                    }}
                    className="range-dual absolute inset-x-0 bottom-0 z-10 w-full"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span>0s</span>
                  <span>{videoDuration !== null ? `${videoDuration.toFixed(1)}s` : "—"}</span>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  Шаг между кадрами (сек)
                </label>
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={frameStep}
                  onChange={(e) => setFrameStep(Number(e.target.value) || 1)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    Скорость GIF (кадров/сек)
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    max={30}
                    step={0.5}
                    value={gifFps}
                    onChange={(e) => setGifFps(Number(e.target.value) || 5)}
                    className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                  <label className="mt-3 flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={autoGenerate}
                      onChange={(e) => setAutoGenerate(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:outline-none focus:ring-0 dark:border-zinc-600"
                    />
                    <span>Автообновление кадров и GIF при изменении параметров</span>
                  </label>
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
                {error}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="space-y-2">
                <button
                  onClick={extractFrames}
                  disabled={isProcessing}
                  className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isProcessing ? "Извлечение кадров..." : "Извлечь кадры"}
                </button>

                <button
                  onClick={generateGif}
                  disabled={isGeneratingGif || frames.length === 0}
                  className="w-full rounded-md border border-blue-600 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-950/30"
                >
                  {isGeneratingGif ? "Создание GIF..." : "Создать GIF из кадров"}
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* GIF preview (right column, full height of top row) */}
        <Card>
          <div className="flex h-full flex-col">
            <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
              GIF-превью
            </h3>
            {gifError && (
              <div className="mb-2 rounded-md bg-red-50 p-2 text-xs text-red-800 dark:bg-red-900/20 dark:text-red-200">
                {gifError}
              </div>
            )}
            {gifDataUrl ? (
              <div className="space-y-2">
                <img
                  src={gifDataUrl}
                  alt="GIF preview"
                  className="max-h-64 w-full rounded-md border border-zinc-200 object-contain dark:border-zinc-700"
                />
                <button
                  onClick={() => {
                    if (!gifDataUrl) return;
                    const a = document.createElement("a");
                    a.href = gifDataUrl;
                    a.download = "frames.gif";
                    a.click();
                  }}
                  className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Скачать GIF
                </button>
              </div>
            ) : (
              <p className="text-xs text-zinc-600 dark:text-zinc-400">
                Создайте GIF, чтобы увидеть здесь превью.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Output frames - full-width row, fills remaining height */}
      <Card className="flex min-h-[220px] flex-1 flex-col gap-4">
        <div className="flex flex-1 flex-col">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Извлечённые кадры ({frames.length})
            </h3>
          </div>

          {frames.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Кадры появятся здесь после извлечения.
            </p>
          ) : (
            <div className="flex h-full items-stretch gap-3 overflow-x-auto overflow-y-hidden pr-1 pb-1">
              {frames.map((frame, index) => (
                <div
                  key={index}
                  className="flex h-full w-40 flex-shrink-0 flex-col justify-between rounded-md border border-zinc-200 p-2 dark:border-zinc-700"
                >
                  <img
                    src={frame.dataUrl}
                    alt={`Кадр ${index + 1}`}
                    className="w-full flex-1 rounded-md object-contain bg-zinc-100 dark:bg-zinc-800"
                  />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
                    <span>{frame.time.toFixed(2)}s</span>
                    <button
                      onClick={() => handleDownload(frame, index)}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Скачать
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Hidden video/canvas elements for processing */}
      <video ref={videoRef} className="hidden" />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
