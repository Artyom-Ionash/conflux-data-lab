import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { downloadDataUrl } from '@/core/browser/canvas';
import { useDebounceEffect } from '@/core/react/hooks/use-debounce';
import { useMediaSession } from '@/core/react/hooks/use-media-session';
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

export interface ExtractorStatus {
  isProcessing: boolean;
  currentStep: 'extracting' | 'generating' | '';
  progress: number;
}

export function useFrameExtractor() {
  // --- 1. Resources (Delegated to Core) ---
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // 💎 CRYSTAL USAGE: Одна строка заменяет 30 строк ручного управления DOM
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
  const [status, setStatus] = useState<ExtractorStatus>({
    isProcessing: false,
    currentStep: '',
    progress: 0,
  });
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  // --- 4. Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const hoverVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- 5. Reactions (Autoconfig) ---

  // Авто-настройка при успешной загрузке метаданных из ядра
  useEffect(() => {
    // Используем Early Exit, чтобы гарантировать возврат значения (или undefined) во всех путях
    if (!session.dimensions?.duration) return;

    const duration = session.dimensions.duration;
    const safeStartTime = Math.max(0, duration - DEFAULT_CLIP_DURATION);

    // Оборачиваем пакетное обновление стейта в RAF
    const rafId = requestAnimationFrame(() => {
      _setExtractionParams({
        startTime: safeStartTime,
        endTime: duration,
        frameStep: DEFAULT_FRAME_STEP,
      });
      setSymmetricLoop(true);
      setGifParams((p) => ({ ...p, fps: Math.round(1 / DEFAULT_FRAME_STEP), dataUrl: null }));
      setRawFrames([]);
      setRuntimeError(null);
    });

    return () => cancelAnimationFrame(rafId);
  }, [session.dimensions]);

  // Синхронизация Hover Video с URL из сессии
  useEffect(() => {
    if (hoverVideoRef.current && session.url && hoverVideoRef.current.src !== session.url) {
      hoverVideoRef.current.src = session.url;
    }
  }, [session.url]);

  // --- 6. Logic ---

  const effectiveEnd = useMemo(
    () =>
      extractionParams.endTime > 0 ? extractionParams.endTime : (session.dimensions?.duration ?? 0),
    [extractionParams.endTime, session.dimensions?.duration]
  );

  const frames = useMemo(() => {
    return applySymmetricLoop(rawFrames, symmetricLoop);
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

  // Auto-run Extraction
  const runExtraction = useCallback(async () => {
    if (!videoRef.current || !session.url || !session.dimensions) return;
    const videoEl = videoRef.current;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setStatus({ isProcessing: true, currentStep: 'extracting', progress: 0 });
    setRuntimeError(null);

    try {
      // Гарантируем, что видео-элемент использует актуальный URL
      if (videoEl.src !== session.url) videoEl.src = session.url;
      if (videoEl.readyState < 1) {
        await new Promise((resolve) => {
          videoEl.onloadedmetadata = resolve;
        });
      }

      const totalTimestamps = calculateTimestamps(extractionParams, videoEl.duration);
      setRawFrames(totalTimestamps.map((t) => ({ time: t, dataUrl: null })));

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
        setRuntimeError(e.message);
        setStatus({ isProcessing: false, currentStep: '', progress: 0 });
      }
    }
  }, [session.url, session.dimensions, extractionParams]);

  useDebounceEffect(
    () => {
      if (session.url) void runExtraction();
    },
    [runExtraction, session.url],
    600
  );

  const handleFilesSelected = useCallback((files: File[]) => {
    const file = files[0];
    if (file) setVideoFile(file);
  }, []);

  const generateAndDownloadGif = useCallback(async () => {
    const validFrames = frames.map((f) => f.dataUrl).filter((url): url is string => url !== null);
    if (validFrames.length === 0) return;

    setStatus({ isProcessing: true, currentStep: 'generating', progress: 0 });
    setRuntimeError(null);

    try {
      // Искусственная задержка для обновления UI
      await new Promise((r) => setTimeout(r, 50));
      const imageUrl = await createGif({
        images: validFrames,
        fps: gifParams.fps,
        width: session.dimensions?.width || 300,
        height: session.dimensions?.height || 200,
      });
      downloadDataUrl(imageUrl, 'animation.gif');
      setGifParams((p) => ({ ...p, dataUrl: imageUrl }));
      setStatus({ isProcessing: false, currentStep: '', progress: 100 });
    } catch (e) {
      setRuntimeError(e instanceof Error ? e.message : 'GIF Generation Error');
      setStatus({ isProcessing: false, currentStep: '', progress: 0 });
    }
  }, [frames, gifParams.fps, session.dimensions]);

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
      status,
      // Объединяем ошибки загрузки (Core) и ошибки рантайма (Tool)
      error: session.error || runtimeError,
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
