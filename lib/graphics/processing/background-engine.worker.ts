/// <reference lib="webworker" />

import { pipe } from 'remeda';

import type { RGB } from '@/core/primitives/colors';
import { PIXEL_STRIDE } from '@/core/primitives/colors';

import type { Point } from './imaging';
import {
  applyBlur,
  applyColorFilter,
  applyEdgePaint,
  applyFloodFillMask,
  applyMorphologyChoke,
} from './imaging';

// --- Types ---

export type ProcessingMode = 'remove' | 'keep' | 'flood-clear';

export interface WorkerPayload {
  imageData: Uint8ClampedArray;
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

declare const self: DedicatedWorkerGlobalScope;

// --- Worker Logic ---

self.onmessage = (e: MessageEvent<WorkerPayload>) => {
  try {
    const { imageData, width, height, mode, settings } = e.data;

    // --- 1. Подготовка этапов (Stage Helpers) ---

    const generateBaseMask = (): Uint8Array => {
      if (mode === 'flood-clear') {
        // FIX: Передаем targetColor вместо contourColor.
        // Теперь flood fill работает как Magic Wand по целевому цвету.
        return applyFloodFillMask(
          imageData,
          width,
          height,
          settings.floodPoints,
          settings.targetColor,
          settings.tolerance,
          settings.maxRgbDistance
        );
      }
      return applyColorFilter(
        imageData,
        width,
        height,
        settings.targetColor,
        settings.tolerance,
        settings.smoothness,
        mode,
        settings.maxRgbDistance
      );
    };

    const withChoke = (mask: Uint8Array): Uint8Array => {
      if (settings.edgeChoke <= 0) return mask;
      return applyMorphologyChoke(mask, width, height, settings.edgeChoke);
    };

    const withBlur = (mask: Uint8Array): Uint8Array => {
      if (settings.edgeBlur <= 0) return mask;
      return applyBlur(mask, width, height, settings.edgeBlur);
    };

    // --- 2. Pipeline Execution ---

    const alphaChannel = pipe(
      generateBaseMask(), // Начальные данные
      withChoke, // Шаг 1: Сжатие
      withBlur // Шаг 2: Размытие
    );

    // --- 3. Post-Processing & Merge ---

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

    // Merge Alpha into Output
    const OFFSET_A = 3;
    for (let i = 0, idx = 0; i < imageData.length; i += PIXEL_STRIDE, idx++) {
      imageData[i + OFFSET_A] = alphaChannel[idx] ?? 255;
    }

    // --- 4. Transfer ---
    self.postMessage({ processedData: imageData }, [imageData.buffer]);
  } catch (error) {
    console.error('Worker error:', error);
    self.postMessage({
      processedData: new Uint8ClampedArray(0),
      error: error instanceof Error ? error.message : 'Unknown worker error',
    });
  }
};
