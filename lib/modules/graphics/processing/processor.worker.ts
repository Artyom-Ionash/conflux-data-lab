import { PIXEL_STRIDE, RGB } from '@/lib/core/utils/colors';

import {
  applyBlur,
  applyColorFilter,
  applyEdgePaint,
  applyFloodFillMask,
  applyMorphologyChoke,
  Point,
} from './filters';

// --- Types ---

export type ProcessingMode = 'remove' | 'keep' | 'flood-clear';

export interface WorkerPayload {
  imageData: Uint8ClampedArray; // Передаем сырой буфер
  width: number;
  height: number;
  mode: ProcessingMode;
  settings: {
    targetColor: RGB;
    contourColor: RGB;
    tolerance: number;
    smoothness: number;
    edgeChoke: number;
    edgeBlur: number;
    edgePaint: number;
    maxRgbDistance: number;
    floodPoints: Point[];
  };
}

export interface WorkerResponse {
  processedData: Uint8ClampedArray;
  error?: string;
}

// --- Worker Logic ---

self.onmessage = (e: MessageEvent<WorkerPayload>) => {
  try {
    const { imageData, width, height, mode, settings } = e.data;

    // ВАЖНО: imageData приходит как Uint8ClampedArray.
    // Для модификации мы работаем с ним напрямую (mutating) или создаем копии для шагов.

    let alphaChannel: Uint8Array;

    // 1. GENERATE BASE ALPHA MASK
    if (mode === 'flood-clear') {
      alphaChannel = applyFloodFillMask(
        imageData,
        width,
        height,
        settings.floodPoints,
        settings.contourColor,
        settings.tolerance,
        settings.maxRgbDistance
      );
    } else {
      alphaChannel = applyColorFilter(
        imageData,
        width,
        height,
        settings.targetColor,
        settings.tolerance,
        settings.smoothness,
        mode,
        settings.maxRgbDistance
      );
    }

    // 2. APPLY MORPHOLOGY (Erode/Choke)
    if (settings.edgeChoke > 0) {
      alphaChannel = applyMorphologyChoke(alphaChannel, width, height, settings.edgeChoke);
    }

    // 3. APPLY BLUR
    if (settings.edgeBlur > 0) {
      alphaChannel = applyBlur(alphaChannel, width, height, settings.edgeBlur);
    }

    // 4. APPLY EDGE PAINT (Modifies RGB in place)
    if (settings.edgePaint > 0) {
      applyEdgePaint(
        imageData,
        alphaChannel,
        width,
        height,
        settings.edgePaint,
        settings.contourColor
      );
    }

    // 5. MERGE ALPHA INTO OUTPUT
    // alphaChannel - это Uint8Array (0-255), imageData - это RGBA буфер
    const OFFSET_A = 3;
    for (let i = 0, idx = 0; i < imageData.length; i += PIXEL_STRIDE, idx++) {
      imageData[i + OFFSET_A] = alphaChannel[idx]!;
    }

    // Отправляем результат обратно.
    // ВАЖНО: Добавляем imageData.buffer в список Transferable объектов.
    // Это "отдает" владение памятью обратно главному потоку (zero-copy).
    // Используем 'unknown' как промежуточный тип для избежания 'any' при касте self к Worker scope
    const ctx = self as unknown as Worker;
    ctx.postMessage({ processedData: imageData }, [imageData.buffer]);
  } catch (error) {
    console.error('Worker error:', error);
    const ctx = self as unknown as Worker;
    ctx.postMessage({
      processedData: new Uint8ClampedArray(0),
      error: error instanceof Error ? error.message : 'Unknown worker error',
    });
  }
};
