import { Geist, Geist_Mono } from 'next/font/google';

/**
 * Конфигурация шрифтов приложения.
 * Используется next/font для оптимизации загрузки и CLS (Cumulative Layout Shift).
 */

export const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

export const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});
