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

// Здесь же в будущем могут появиться константы (например, общие длительности анимаций)
