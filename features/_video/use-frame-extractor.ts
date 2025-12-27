import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { downloadDataUrl } from '@/core/browser/canvas';
import { isFunction } from '@/core/primitives/guards'; // <--- NEW
import { useDebounceEffect } from '@/core/react/hooks/use-debounce';
import { useMediaSession } from '@/core/react/hooks/use-media-session';
import { useTask } from '@/core/react/hooks/use-task';
import {
  applySymmetricLoop,
  calculateTimestamps,
  type ExtractedFrame,
  type ExtractionParams,
  runExtractionTask,
} from '@/lib/video/extraction';
import { createGif } from '@/lib/video/gif-encoder';

const DEFAULT_CLIP_DURATION = 0.5;
const DEFAULT_FRAME_STEP = 0.1;
const DEFAULT_FPS = 10;

// Упрощенный статус для UI
export interface ExtractorStatus {
  isProcessing: boolean;
  progress: number;
}

export function useFrameExtractor() {
  // --- 1. Resources ---
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const session = useMediaSession(videoFile, 'video');

  // --- 2. Params ---
  const [extractionParams, _setExtractionParams] = useState<ExtractionParams>({
    startTime: 0,
    endTime: 0,
    frameStep: 1,
  });

  const [symmetricLoop, setSymmetricLoop] = useState(false);
  const [gifParams, setGifParams] = useState({
    fps: DEFAULT_FPS,
    dataUrl: null as string | null,
  });

  // --- 3. State ---
  const [rawFrames, setRawFrames] = useState<ExtractedFrame[]>([]);

  // --- 4. Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const hoverVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- 5. TASKS ---

  // Task A: Extraction
  const extractionTask = useTask<void, [HTMLVideoElement]>(
    // Используем деструктуризацию scope, чтобы получить setProgress внутри функции
    async ({ signal, setProgress }, videoEl) => {
      // 1. Sync Source safely (без '!')
      if (session.url && videoEl.src !== session.url) {
        videoEl.src = session.url;
      }

      // 2. Wait for Metadata (Abortable)
      if (videoEl.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => {
            videoEl.removeEventListener('error', onError);
            resolve();
          };
          const onError = () => {
            videoEl.removeEventListener('loadedmetadata', onLoaded);
            reject(new Error('Video load failed'));
          };
          const onAbort = () => {
            videoEl.removeEventListener('loadedmetadata', onLoaded);
            videoEl.removeEventListener('error', onError);
            reject(new Error('Aborted'));
          };

          videoEl.addEventListener('loadedmetadata', onLoaded, { once: true });
          videoEl.addEventListener('error', onError, { once: true });

          // Если сигнал сработал во время ожидания загрузки
          if (signal.aborted) {
            onAbort();
          } else {
            signal.addEventListener('abort', onAbort, { once: true });
          }
        });
      }

      if (signal.aborted) return;

      const totalTimestamps = calculateTimestamps(extractionParams, videoEl.duration);

      // Reset state before run
      setRawFrames(totalTimestamps.map((t) => ({ time: t, dataUrl: null })));

      await runExtractionTask(videoEl, extractionParams, {
        signal,
        onFrame: (frame, index) => {
          if (signal.aborted) return;

          setRawFrames((prev) => {
            // Защита от записи в "сброшенный" массив новой задачи
            if (prev.length === 0 || prev.length !== totalTimestamps.length) return prev;
            const next = [...prev];
            next[index] = frame;
            return next;
          });
        },
        // Используем внедренную функцию, а не внешнюю переменную
        onProgress: setProgress,
      });
    }
  );

  // Task B: GIF Generation
  const gifTask = useTask<string, [string[]]>(async ({ signal }, images) => {
    // Искусственная задержка для UI
    await new Promise((r) => setTimeout(r, 50));

    const imageUrl = await createGif({
      images,
      fps: gifParams.fps,
      width: session.dimensions?.width || 300,
      height: session.dimensions?.height || 200,
    });

    if (signal.aborted) throw new Error('Aborted');
    return imageUrl;
  });

  // --- 6. Reactions ---

  // Извлекаем стабильные методы для использования в эффектах
  const { reset: resetExtraction } = extractionTask;
  const { reset: resetGif } = gifTask;

  useEffect(() => {
    if (!session.dimensions?.duration) return;
    const duration = session.dimensions.duration;

    requestAnimationFrame(() => {
      _setExtractionParams({
        startTime: Math.max(0, duration - DEFAULT_CLIP_DURATION),
        endTime: duration,
        frameStep: DEFAULT_FRAME_STEP,
      });
      setSymmetricLoop(true);
      setGifParams((p) => ({ ...p, fps: Math.round(1 / DEFAULT_FRAME_STEP), dataUrl: null }));
      setRawFrames([]);
      // Используем деструктурированные методы, чтобы избежать зависимостей от всего объекта task
      resetExtraction();
      resetGif();
    });
  }, [session.dimensions, resetExtraction, resetGif]);

  // Синхронизация Hover Video с URL из сессии
  useEffect(() => {
    if (hoverVideoRef.current && session.url && hoverVideoRef.current.src !== session.url) {
      hoverVideoRef.current.src = session.url;
    }
  }, [session.url]);

  // --- 7. Logic ---

  const effectiveEnd = useMemo(
    () =>
      extractionParams.endTime > 0 ? extractionParams.endTime : (session.dimensions?.duration ?? 0),
    [extractionParams.endTime, session.dimensions?.duration]
  );

  const frames = useMemo(
    () => applySymmetricLoop(rawFrames, symmetricLoop),
    [rawFrames, symmetricLoop]
  );

  const setExtractionParams = useCallback(
    (update: ExtractionParams | ((prev: ExtractionParams) => ExtractionParams)) => {
      // Используем универсальный Guard вместо typeof
      const next = isFunction<(prev: ExtractionParams) => ExtractionParams>(update)
        ? update(extractionParams)
        : update;

      if (next.frameStep !== extractionParams.frameStep && next.frameStep > 0) {
        setGifParams((g) => ({
          ...g,
          fps: Math.max(1, Math.min(60, Math.round(1 / next.frameStep))),
        }));
      }
      _setExtractionParams(next);
    },
    [extractionParams]
  );

  // Auto-run extraction
  useDebounceEffect(
    () => {
      if (session.url && videoRef.current) {
        void extractionTask.run(videoRef.current);
      }
    },
    [session.url, extractionParams],
    600
  );

  const handleFilesSelected = useCallback((files: File[]) => {
    const file = files[0];
    if (file) setVideoFile(file);
  }, []);

  const generateAndDownloadGif = useCallback(async () => {
    const validFrames = frames.map((f) => f.dataUrl).filter((url): url is string => url !== null);
    if (validFrames.length === 0) return;

    const url = await gifTask.run(validFrames);
    if (url) {
      downloadDataUrl(url, 'animation.gif');
      setGifParams((p) => ({ ...p, dataUrl: url }));
    }
  }, [frames, gifTask]);

  // Combined status
  const isProcessing = extractionTask.isRunning || gifTask.isRunning;
  const progress = extractionTask.isRunning ? extractionTask.progress : gifTask.isRunning ? 50 : 0;

  return {
    refs: { videoRef, previewVideoRef, hoverVideoRef, canvasRef },
    state: {
      videoSrc: session.url,
      videoDuration: session.dimensions?.duration ?? null,
      videoDimensions: session.dimensions,
      extractionParams,
      symmetricLoop,
      frames,
      gifParams,
      status: { isProcessing, progress },
      error: session.error || extractionTask.error?.message || gifTask.error?.message || null,
      effectiveEnd,
    },
    actions: {
      setExtractionParams,
      setSymmetricLoop,
      setGifParams,
      handleFilesSelected,
      generateAndDownloadGif,
    },
  };
}
