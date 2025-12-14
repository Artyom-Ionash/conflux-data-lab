/**
 * Утилиты для работы с цветом.
 * Использует библиотеку colord для надежного парсинга и конвертации.
 */

import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';

// Расширяем colord для поддержки имен цветов ('red', 'blue', 'transparent')
extend([namesPlugin]);

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export const PIXEL_STRIDE = 4; // R, G, B, A

/**
 * Парсит ЛЮБОЙ валидный CSS цвет (hex, rgb, rgba, hsl, name) в RGB объект.
 * Возвращает null, если цвет невалиден.
 */
export function hexToRgb(input: string): RGB | null {
  const c = colord(input);
  if (!c.isValid()) return null;

  const { r, g, b } = c.toRgb();
  return { r, g, b };
}

/**
 * Надежно преобразует RGB компоненты в HEX строку.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return colord({ r, g, b }).toHex();
}

/**
 * Инвертирует цвет (создает негатив).
 * Поддерживает любой входной формат, возвращает HEX.
 */
export function invertHex(input: string): string {
  const c = colord(input);
  // Если входной цвет невалиден (например 'transparent' или null), возвращаем черный
  if (!c.isValid()) return '#000000';
  return c.invert().toHex();
}

// --- High Performance Helpers (Без аллокации объектов) ---
// Эти функции вызываются миллионы раз в циклах обработки изображений.
// Использование colord здесь убьет производительность, поэтому оставляем Math.hypot.

/**
 * Вычисляет евклидово расстояние между двумя цветами в пространстве RGB.
 */
export function getColorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number
): number {
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

/**
 * Проверяет, являются ли цвета похожими в пределах заданного порога.
 */
export function areColorsSimilar(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
  threshold: number
): boolean {
  return getColorDistance(r1, g1, b1, r2, g2, b2) <= threshold;
}
