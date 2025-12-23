/**
 * [ИНФРАСТРУКТУРА] UI Standards
 * Технический регламент и общие инструменты для UI.
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Отраслевой стандарт склейки классов Tailwind.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Генерирует объект стилей aspectRatio для CSS.
 * Может принимать (width, height) или (ratio).
 */
export function getAspectRatioStyle(
  widthOrRatio?: number | null,
  height?: number | null
): React.CSSProperties {
  if (!widthOrRatio) return {};

  // Если передан только один аргумент — считаем его готовым ratio
  if (height === undefined || height === null) {
    return { aspectRatio: `${widthOrRatio}` };
  }

  return { aspectRatio: `${widthOrRatio} / ${height}` };
}

/**
 * Стандартный CSS-паттерн для отображения прозрачности (шахматная доска).
 */
export const TRANSPARENCY_PATTERN_CSS = (color = '#ccc', transparent = 'transparent') => `
  linear-gradient(45deg, ${color} 25%, ${transparent} 25%),
  linear-gradient(-45deg, ${color} 25%, ${transparent} 25%),
  linear-gradient(45deg, ${transparent} 75%, ${color} 75%),
  linear-gradient(-45deg, ${transparent} 75%, ${color} 75%)
`;
