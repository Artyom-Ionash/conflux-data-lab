// lib/core/utils/styles.ts
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Объединяет классы Tailwind, разрешая конфликты (p-4 vs p-2)
 * и обрабатывая условную логику.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
