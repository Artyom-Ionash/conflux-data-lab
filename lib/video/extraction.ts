/**
 * Технологический процесс извлечения последовательности кадров.
 */

import { VideoFrameSampler } from './_sampler';

export interface ExtractionParams {
  startTime: number;
  endTime: number;
  frameStep: number;
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
 * Генерирует СТРОГО линейную последовательность.
 */
export function calculateTimestamps(params: ExtractionParams, duration: number): number[] {
  const { startTime, endTime, frameStep } = params;
  const effectiveEnd = Math.min(endTime, duration);

  // Защита от бесконечного цикла
  if (frameStep <= 0) return [startTime];

  const numberOfSteps = Math.floor((effectiveEnd - startTime) / frameStep);

  const timestamps: number[] = [];
  for (let i = 0; i <= numberOfSteps; i++) {
    timestamps.push(startTime + i * frameStep);
  }

  return timestamps;
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
