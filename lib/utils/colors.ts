/**
 * Утилиты для работы с цветом.
 * Используются в инструментах анализа изображений и генерации палитр.
 */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

// Константы для парсинга
const HEX_BASE = 16;
const RGB_MAX = 255;
export const PIXEL_STRIDE = 4; // R, G, B, A

/**
 * Преобразует HEX строку (например, "#ffffff" или "000") в объект RGB.
 */
export function hexToRgb(hex: string): RGB | null {
  // Поддержка полных (#RRGGBB) и сокращенных (#RGB) форматов
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: Number.parseInt(result[1], HEX_BASE),
        g: Number.parseInt(result[2], HEX_BASE),
        b: Number.parseInt(result[3], HEX_BASE),
      }
    : null;
}

const toHex = (c: number) => {
  const hex = Math.max(0, Math.min(RGB_MAX, Math.round(c))).toString(HEX_BASE);
  return hex.length === 1 ? '0' + hex : hex;
};

/**
 * Преобразует RGB компоненты в HEX строку.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Инвертирует цвет (создает негатив). Полезно для контрастных обводок.
 */
export function invertHex(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000';
  return rgbToHex(RGB_MAX - rgb.r, RGB_MAX - rgb.g, RGB_MAX - rgb.b);
}

/**
 * Вычисляет евклидово расстояние между двумя цветами в пространстве RGB.
 * Чем меньше значение, тем более похожи цвета.
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
