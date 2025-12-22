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
 * Генерирует объект стилей aspectRatio для CSS на основе размеров.
 */
export function getAspectRatioStyle(
  width?: number | null,
  height?: number | null
): React.CSSProperties {
  if (!width || !height) return {};
  return { aspectRatio: `${width} / ${height}` };
}
