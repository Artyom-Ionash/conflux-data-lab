import { describe, expect, it } from 'vitest';

import type { RGB } from '@/core/primitives/colors';

import { applyFloodFillMask, applyMorphologyChoke } from './imaging';

// --- HELPERS ---

/**
 * Создает пустой RGBA буфер заданного цвета
 */
function createMockImage(
  width: number,
  height: number,
  color: RGB = { r: 255, g: 255, b: 255 }
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = color.r;
    data[i + 1] = color.g;
    data[i + 2] = color.b;
    data[i + 3] = 255; // Alpha
  }
  return data;
}

/**
 * Устанавливает цвет конкретного пикселя
 */
function setPixel(data: Uint8ClampedArray, width: number, x: number, y: number, color: RGB) {
  const i = (y * width + x) * 4;
  data[i] = color.r;
  data[i + 1] = color.g;
  data[i + 2] = color.b;
  data[i + 3] = 255;
}

const BLACK: RGB = { r: 0, g: 0, b: 0 };
const WHITE: RGB = { r: 255, g: 255, b: 255 };
// --- TESTS ---

describe('Graphics Filters', () => {
  describe('applyFloodFillMask', () => {
    it('should fill a bounded area based on similarity (Magic Wand)', () => {
      // SCENARIO: 4x4 Grid
      // We draw a "wall" of BLACK pixels vertically in the middle.
      // We start filling from the left side (WHITE).
      // Left side should become TRANSPARENT (0) because it matches Target (WHITE).
      // Wall (BLACK) should remain OPAQUE (255) because it differs from Target.
      // Right side (WHITE) should remain OPAQUE (255) because it's unreachable.

      const width = 4;
      const height = 4;
      const data = createMockImage(width, height, WHITE);

      // Draw Wall at x=2
      for (let y = 0; y < height; y++) {
        setPixel(data, width, 2, y, BLACK);
      }

      // Action: Fill starting at (0,0) targeting WHITE
      const resultAlpha = applyFloodFillMask(
        data,
        width,
        height,
        [{ x: 0, y: 0 }],
        WHITE, // FIX: Target Color must be WHITE to clear white pixels
        10, // Tolerance
        441 // Max RGB Dist
      );

      // Assertions

      // 1. Check (0,0) - Should be cleared (0)
      expect(resultAlpha[0]).toBe(0);

      // 2. Check (1,0) - Should be cleared (0)
      expect(resultAlpha[1]).toBe(0);

      // 3. Check (2,0) - The Wall. Should be preserved (255)
      expect(resultAlpha[2]).toBe(255);

      // 4. Check (3,0) - Behind the wall. Should be preserved (255)
      // Because the fill shouldn't reach it.
      expect(resultAlpha[3]).toBe(255);
    });

    it('should handle out of bounds start points gracefully', () => {
      const width = 2;
      const height = 2;
      const data = createMockImage(width, height, WHITE);

      // Should not throw
      const result = applyFloodFillMask(
        data,
        width,
        height,
        [
          { x: 50, y: 50 },
          { x: -1, y: 0 },
        ], // Invalid points
        WHITE, // Target WHITE (if points were valid, it would clear)
        0,
        441
      );

      // Should return fully opaque mask (nothing happened because coordinates invalid)
      expect(result[0]).toBe(255);
    });
  });

  describe('applyMorphologyChoke (Erosion)', () => {
    it('should erode pixels touching transparency', () => {
      // SCENARIO: 3x3 Grid
      // Center pixel (1,1) is surrounded by Transparent pixels (0).
      // It should be eaten by erosion.

      const width = 3;
      const height = 3;
      // Init: All Transparent
      const alphaChannel = new Uint8Array(width * height).fill(0);

      // Set Center to Opaque
      const centerIdx = 1 * width + 1;
      alphaChannel[centerIdx] = 255;

      const result = applyMorphologyChoke(alphaChannel, width, height, 1);

      // Center should become 0 because neighbors are 0
      expect(result[centerIdx]).toBe(0);
    });

    it('should preserve pixels deep inside opaque area', () => {
      // SCENARIO: 5x5 Grid.
      // A 3x3 block of Opaque pixels in the center.
      // Radius = 1.
      // The very center pixel (2,2) is surrounded by 255, so it should survive.
      // The border pixels of the block should die.

      const width = 5;
      const height = 5;
      const alphaChannel = new Uint8Array(width * height).fill(0);

      // Create 3x3 block of 255 from (1,1) to (3,3)
      for (let y = 1; y <= 3; y++) {
        for (let x = 1; x <= 3; x++) {
          alphaChannel[y * width + x] = 255;
        }
      }

      const result = applyMorphologyChoke(alphaChannel, width, height, 1);

      // (2,2) - Very center. Neighbors (1,1)...(3,3) are all 255.
      // So (2,2) should STAY 255.
      expect(result[2 * width + 2]).toBe(255);

      // (1,2) - Left edge of the block. Its neighbor (0,2) is 0.
      // So (1,2) should become 0.
      expect(result[1 * width + 2]).toBe(0);
    });
  });
});
