import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { downloadDataUrl } from '@/core/browser/canvas';
import { useDebounceEffect } from '@/core/react/hooks/use-debounce';
import { useObjectUrl } from '@/core/react/hooks/use-object-url';
import {
  calculateTimestamps,
  type ExtractedFrame,
  type ExtractionParams,
  runExtractionTask,
} from '@/lib/video/extraction';
import { createGif } from '@/lib/video/gif-encoder';

const DEFAULT_CLIP_DURATION = 0.5;
const DEFAULT_FRAME_STEP = 0.1;
const DEFAULT_FPS = 10;

export interface ExtractorStatus {
  isProcessing: boolean;
  currentStep: 'extracting' | 'generating' | '';
  progress: number;
}

export function useFrameExtractor() {
  // --- Resources ---
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoSrc = useObjectUrl(videoFile);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(
    null
  );

  // --- Params ---
  // 1. Capture Params (Влияют на тяжелый процесс извлечения)
  const [extractionParams, _setExtractionParams] = useState<ExtractionParams>({
    startTime: 0,
    endTime: 0,
    frameStep: 1,
  });

  // 2. Post-Process Params (Мгновенное влияние на отображение)
  const [symmetricLoop, setSymmetricLoop] = useState(false);

  const [gifParams, setGifParams] = useState({
    fps: DEFAULT_FPS,
    dataUrl: null as string | null,
  });

  // --- State ---
  const [rawFrames, setRawFrames] = useState<ExtractedFrame[]>([]);
  const [status, setStatus] = useState<ExtractorStatus>({
    isProcessing: false,
    currentStep: '',
    progress: 0,
  });
  const [error, setError] = useState<string | null>(null);

  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const hoverVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- Computed ---
  const effectiveEnd = useMemo(
    () => (extractionParams.endTime > 0 ? extractionParams.endTime : (videoDuration ?? 0)),
    [extractionParams.endTime, videoDuration]
  );

  // Логика зацикливания перенесена сюда (Pure View Logic)
  // Это НЕ вызывает перезапуск видео-процессинга
  const frames = useMemo(() => {
    if (rawFrames.length < 2) return rawFrames;
    if (!symmetricLoop) return rawFrames;

    // Создаем зеркальную копию (исключая первый и последний кадр для плавности)
    const loopBack = rawFrames.slice(1, -1).reverse();
    return [...rawFrames, ...loopBack];
  }, [rawFrames, symmetricLoop]);

  // --- Handlers (Interception Logic) ---

  // Wrapper to handle side-effects of changing params (like Auto-FPS)
  const setExtractionParams = useCallback(
    (update: ExtractionParams | ((prev: ExtractionParams) => ExtractionParams)) => {
      // Resolve the next value immediately using current state closure
      const next = typeof update === 'function' ? update(extractionParams) : update;

      // Logic: If frameStep changes, auto-calculate FPS
      if (next.frameStep !== extractionParams.frameStep && next.frameStep > 0) {
        const calculatedFps = Math.round(1 / next.frameStep);
        const safeFps = Math.max(1, Math.min(60, calculatedFps));
        setGifParams((g) => ({ ...g, fps: safeFps }));
      }

      _setExtractionParams(next);
    },
    [extractionParams]
  );

  // --- Effects ---

  // Sync Hover Video
  useEffect(() => {
    if (hoverVideoRef.current && videoSrc && hoverVideoRef.current.src !== videoSrc) {
      hoverVideoRef.current.src = videoSrc;
    }
  }, [videoSrc]);

  // Auto-run Extraction
  const runExtraction = useCallback(async () => {
    if (!videoRef.current || !videoSrc) return;
    const videoEl = videoRef.current;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setStatus({ isProcessing: true, currentStep: 'extracting', progress: 0 });
    setError(null);

    try {
      if (videoEl.src !== videoSrc) videoEl.src = videoSrc;
      if (videoEl.readyState < 1) {
        await new Promise((resolve) => {
          videoEl.onloadedmetadata = resolve;
        });
      }

      const totalTimestamps = calculateTimestamps(extractionParams, videoEl.duration);
      const initialFrames: ExtractedFrame[] = totalTimestamps.map((t) => ({
        time: t,
        dataUrl: null,
      }));
      setRawFrames(initialFrames);

      await runExtractionTask(videoEl, extractionParams, {
        signal: abortControllerRef.current.signal,
        onFrame: (frame, index) => {
          setRawFrames((prev) => {
            if (prev.length === 0) return prev;
            return prev.map((f, i) => (i === index ? frame : f));
          });
        },
        onProgress: (progress) => setStatus((s) => ({ ...s, progress })),
      });

      setStatus({ isProcessing: false, currentStep: '', progress: 100 });
    } catch (e: unknown) {
      if (e instanceof Error && e.message !== 'Extraction Aborted') {
        setError(e.message);
        setStatus({ isProcessing: false, currentStep: '', progress: 0 });
      }
    }
  }, [videoSrc, extractionParams]);

  // Debounce только для тяжелых параметров.
  // symmetricLoop здесь нет, поэтому он не триггерит этот эффект.
  useDebounceEffect(
    () => {
      if (videoSrc) void runExtraction();
    },
    [runExtraction, videoSrc],
    600
  );

  // --- Actions ---

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const file = files[0];
    if (!file) return;

    setRawFrames([]);
    setError(null);
    setGifParams((p) => ({ ...p, dataUrl: null }));
    setVideoDuration(null);
    setVideoDimensions(null);
    setVideoFile(file);

    const objectUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement('video');
    tempVideo.src = objectUrl;

    tempVideo.onloadedmetadata = () => {
      const duration = tempVideo.duration || 0;
      setVideoDuration(duration);
      setVideoDimensions({ width: tempVideo.videoWidth, height: tempVideo.videoHeight });

      const safeStartTime = Math.max(0, duration - DEFAULT_CLIP_DURATION);

      _setExtractionParams({
        startTime: safeStartTime,
        endTime: duration,
        frameStep: DEFAULT_FRAME_STEP,
      });

      setSymmetricLoop(true); // Default to loop enabled

      const calculatedFps = Math.round(1 / DEFAULT_FRAME_STEP);
      setGifParams((p) => ({ ...p, fps: calculatedFps }));

      URL.revokeObjectURL(objectUrl);
    };

    tempVideo.onerror = () => {
      setError('Ошибка загрузки видео');
      URL.revokeObjectURL(objectUrl);
    };
  }, []);

  const generateAndDownloadGif = useCallback(async () => {
    const validFrames = frames.map((f) => f.dataUrl).filter((url): url is string => url !== null);

    if (validFrames.length === 0) return;

    setStatus({ isProcessing: true, currentStep: 'generating', progress: 0 });
    setError(null);

    try {
      // Искусственная задержка для обновления UI
      await new Promise((r) => setTimeout(r, 50));

      const imageUrl = await createGif({
        images: validFrames,
        fps: gifParams.fps,
        width: videoDimensions?.width || 300,
        height: videoDimensions?.height || 200,
      });

      downloadDataUrl(imageUrl, 'animation.gif');

      setGifParams((p) => ({ ...p, dataUrl: imageUrl }));
      setStatus({ isProcessing: false, currentStep: '', progress: 100 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'GIF Generation Error');
      setStatus({ isProcessing: false, currentStep: '', progress: 0 });
    }
  }, [frames, gifParams.fps, videoDimensions]);

  return {
    refs: {
      videoRef,
      previewVideoRef,
      hoverVideoRef,
      canvasRef,
    },
    state: {
      videoSrc,
      videoDuration,
      videoDimensions,
      extractionParams,
      symmetricLoop,
      frames,
      gifParams,
      status,
      error,
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
