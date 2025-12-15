import type { RGB } from '@/lib/core/utils/colors';
import { getColorDistance, PIXEL_STRIDE } from '@/lib/core/utils/colors';

// --- Constants ---
const RGB_MAX = 255;
const OFFSET_R = 0;
const OFFSET_G = 1;
const OFFSET_B = 2;
// const OFFSET_A = 3;

// --- Types ---
export interface Point {
  x: number;
  y: number;
}

/**
 * Фильтр по цвету (Remove / Keep).
 * Заполняет alphaChannel на основе похожести цветов.
 */
export function applyColorFilter(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  targetColor: RGB,
  tolerance: number, // 0-100
  smoothness: number, // 0-100
  mode: 'remove' | 'keep',
  maxRgbDistance: number
): Uint8Array {
  const alphaChannel = new Uint8Array(width * height);
  const tolVal = (tolerance / 100) * maxRgbDistance;
  const smoothVal = (smoothness / 100) * maxRgbDistance;

  for (let i = 0, idx = 0; i < data.length; i += PIXEL_STRIDE, idx++) {
    // FIX: Используем !, так как шаг цикла гарантирует существование элементов
    const r = data[i + OFFSET_R]!;
    const g = data[i + OFFSET_G]!;
    const b = data[i + OFFSET_B]!;

    const dist = getColorDistance(r, g, b, targetColor.r, targetColor.g, targetColor.b);

    let alpha = RGB_MAX;

    if (mode === 'remove') {
      if (dist <= tolVal) alpha = 0;
      else if (dist <= tolVal + smoothVal && smoothVal > 0) {
        alpha = Math.floor(RGB_MAX * ((dist - tolVal) / smoothVal));
      }
    } else if (mode === 'keep') {
      if (dist > tolVal + smoothVal) alpha = 0;
      else if (dist > tolVal && smoothVal > 0) {
        alpha = Math.floor(RGB_MAX * (1 - (dist - tolVal) / smoothVal));
      }
    }
    alphaChannel[idx] = alpha;
  }

  return alphaChannel;
}

/**
 * Алгоритм заливки (Flood Fill) для создания маски прозрачности.
 */
export function applyFloodFillMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startPoints: Point[],
  contourColor: RGB,
  tolerance: number,
  maxRgbDistance: number
): Uint8Array {
  const alphaChannel = new Uint8Array(width * height).fill(RGB_MAX);

  if (startPoints.length === 0) return alphaChannel;

  const visited = new Uint8Array(width * height);
  const tolVal = (tolerance / 100) * maxRgbDistance;

  startPoints.forEach((pt) => {
    const startX = Math.floor(pt.x);
    const startY = Math.floor(pt.y);
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;

    const stack = [startX, startY];
    while (stack.length) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      const idx = y * width + x;

      if (visited[idx]) continue;
      visited[idx] = 1;

      // Проверка границы (контура)
      const pxIdx = idx * PIXEL_STRIDE;

      // FIX: Используем !
      const r = data[pxIdx + OFFSET_R]!;
      const g = data[pxIdx + OFFSET_G]!;
      const b = data[pxIdx + OFFSET_B]!;

      const dist = getColorDistance(r, g, b, contourColor.r, contourColor.g, contourColor.b);

      if (dist <= tolVal) continue; // Попали в контур, останавливаемся

      alphaChannel[idx] = 0; // Делаем прозрачным

      if (x > 0) stack.push(x - 1, y);
      if (x < width - 1) stack.push(x + 1, y);
      if (y > 0) stack.push(x, y - 1);
      if (y < height - 1) stack.push(x, y + 1);
    }
  });

  return alphaChannel;
}

/**
 * Морфологическая операция: Сжатие (Erosion / Choke).
 * Убирает "шум" по краям маски.
 */
export function applyMorphologyChoke(
  alphaChannel: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  if (radius <= 0) return alphaChannel;

  const eroded = new Uint8Array(alphaChannel);
  const r = radius;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (alphaChannel[i] === 0) continue;

      let hit = false;
      loop: for (let ky = -r; ky <= r; ky++) {
        for (let kx = -r; kx <= r; kx++) {
          const ny = y + ky;
          const nx = x + kx;
          if (
            nx >= 0 &&
            nx < width &&
            ny >= 0 &&
            ny < height &&
            alphaChannel[ny * width + nx] === 0
          ) {
            hit = true;
            break loop;
          }
        }
      }
      if (hit) eroded[i] = 0;
    }
  }
  return eroded;
}

/**
 * Размытие маски (Box Blur).
 */
export function applyBlur(
  alphaChannel: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  if (radius <= 0) return alphaChannel;

  const blurred = new Uint8Array(alphaChannel);
  const r = Math.max(1, radius);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let ky = -r; ky <= r; ky++) {
        for (let kx = -r; kx <= r; kx++) {
          const ny = y + ky;
          const nx = x + kx;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            sum += alphaChannel[ny * width + nx]!;
            count++;
          }
        }
      }
      blurred[y * width + x] = Math.floor(sum / count);
    }
  }
  return blurred;
}

/**
 * Окрашивание краев (Paint Edges).
 * Модифицирует исходный массив пикселей RGB.
 */
export function applyEdgePaint(
  data: Uint8ClampedArray,
  alphaChannel: Uint8Array,
  width: number,
  height: number,
  radius: number,
  color: RGB
): void {
  if (radius <= 0) return;

  const r = radius;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (alphaChannel[i] === 0) continue;

      let isEdge = false;
      loop2: for (let ky = -r; ky <= r; ky++) {
        for (let kx = -r; kx <= r; kx++) {
          const ny = y + ky;
          const nx = x + kx;
          if (
            nx >= 0 &&
            nx < width &&
            ny >= 0 &&
            ny < height &&
            alphaChannel[ny * width + nx] === 0
          ) {
            isEdge = true;
            break loop2;
          }
        }
      }
      if (isEdge) {
        const p = i * PIXEL_STRIDE;
        data[p + OFFSET_R] = color.r;
        data[p + OFFSET_G] = color.g;
        data[p + OFFSET_B] = color.b;
      }
    }
  }
}
