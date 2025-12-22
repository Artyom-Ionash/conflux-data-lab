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
 * Возвращает числовой коэффициент соотношения сторон.
 */
export function getAspectRatio(width?: number | null, height?: number | null): number {
  if (!width || !height) return 1;
  return width / height;
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
