/**
 * Универсальные функции для компоновки и запекания многослойных изображений.
 */

import { downloadDataUrl, loadImage } from '@/lib/core/utils/media';

export interface CompositionLayer {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface StackOptions {
  layers: CompositionLayer[];
  canvasWidth: number;
  canvasHeight: number;
  slotHeight: number;
  backgroundColor: string | null;
  filename: string;
}

/**
 * Рассчитывает смещение для центрирования объекта внутри области.
 */
export function calculateCenterOffset(contentSize: number, containerSize: number): number {
  return Math.round((containerSize - contentSize) / 2);
}

/**
 * Рендерит слои на Canvas и инициирует скачивание.
 * Логика абстрагирована от конкретного инструмента.
 */
export async function bakeVerticalStack({
  layers,
  canvasWidth,
  canvasHeight,
  slotHeight,
  backgroundColor,
  filename,
}: StackOptions): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failure');

  // 1. Заливка фона
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  } else {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  }

  // 2. Отрисовка слоёв с учетом маскирования слота
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    if (!layer) continue;

    const img = await loadImage(layer.url);
    const slotY = i * slotHeight;

    ctx.save();
    // Ограничиваем область рисования текущим слотом (Clip)
    ctx.beginPath();
    ctx.rect(0, slotY, canvasWidth, slotHeight);
    ctx.clip();

    // Рисуем изображение со смещением
    ctx.drawImage(img, layer.x, slotY + layer.y, layer.width, layer.height);
    ctx.restore();
  }

  downloadDataUrl(canvas.toDataURL('image/png'), filename);
}
