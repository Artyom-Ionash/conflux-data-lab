/**
 * [КРИСТАЛЛ] Extraction Process
 * Технологический процесс извлечения последовательности кадров.
 */

import { VideoFrameSampler } from './sampler';

export interface ExtractionParams {
  startTime: number;
  endTime: number;
  frameStep: number;
  symmetricLoop: boolean;
}

export interface ExtractedFrame {
  time: number;
  dataUrl: string | null;
}

interface ExtractionOptions {
  onFrame: (frame: ExtractedFrame, index: number) => void;
  onProgress: (progress: number) => void;
  signal?: AbortSignal;
}

/**
 * Рассчитывает массив временных меток для извлечения.
 */
export function calculateTimestamps(params: ExtractionParams, duration: number): number[] {
  const { startTime, endTime, frameStep, symmetricLoop } = params;
  const effectiveEnd = Math.min(endTime, duration);
  const numberOfSteps = Math.floor((effectiveEnd - startTime) / frameStep);

  const forward: number[] = [];
  for (let i = 0; i <= numberOfSteps; i++) {
    forward.push(startTime + i * frameStep);
  }

  if (!symmetricLoop || forward.length < 2) {
    return forward;
  }

  // Создаем обратный путь, исключая первый и последний кадры для плавности цикла
  const backward = [...forward].slice(1, -1).reverse();
  return [...forward, ...backward];
}

/**
 * Основной процесс экстракции.
 */
export async function runExtractionTask(
  video: HTMLVideoElement,
  params: ExtractionParams,
  options: ExtractionOptions
): Promise<void> {
  const sampler = new VideoFrameSampler(video);
  const timestamps = calculateTimestamps(params, video.duration);

  const total = timestamps.length;

  for (let i = 0; i < total; i++) {
    // Проверка сигнала отмены
    if (options.signal?.aborted) {
      throw new Error('Extraction Aborted');
    }

    const time = timestamps[i] ?? 0;
    const dataUrl = await sampler.captureAt(time);

    options.onFrame({ time, dataUrl }, i);
    options.onProgress(((i + 1) / total) * 100);

    // Даем браузеру "подышать" между кадрами
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}
