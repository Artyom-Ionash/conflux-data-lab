"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gifshot from "gifshot";
import {
  ExtractedFrame,
  ExtractionErrors,
  ExtractionParams,
  ExtractionStatus,
  ExtractionStep,
  GifParams,
} from "../types";

export function useVideoFrameExtraction() {
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

        gifshot.createGIF(
          {
            images: finalFrames.map(f => f.dataUrl),
            interval: intervalSeconds,
            gifWidth: canvasEl.width,
            gifHeight: canvasEl.height,
            numFrames: finalFrames.length,
          },
          (result) => {
            if (result && (result as any).error) {
              const message = String((result as any).error) || "Не удалось создать GIF";
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


