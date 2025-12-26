/**
 * Инструменты для обеспечения кросс-браузерной совместимости.
 * Обрабатывают различия в API (Chrome vs Firefox vs Safari).
 */

import type React from 'react';

export interface DirectorySupport {
  isSupported: boolean;
  isFirefox: boolean;
  status: 'modern' | 'limited' | 'unsupported';
}

/**
 * Проверка поддержки File System Access API (дек. 2025).
 */
export function checkDirectoryPickerSupport(): DirectorySupport {
  if (typeof window === 'undefined') {
    return { isSupported: true, isFirefox: false, status: 'modern' };
  }

  const isSupported = 'showDirectoryPicker' in window;
  const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');

  return {
    isSupported,
    isFirefox,
    status: isSupported ? 'modern' : isFirefox ? 'limited' : 'unsupported',
  };
}

/**
 * Атрибуты для старого способа выбора папок через <input>.
 * Используется как fallback для браузеров без showDirectoryPicker.
 */
export function getLegacyDirectoryAttributes(): React.InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory?: string;
  directory?: string;
} {
  return {
    webkitdirectory: '',
    directory: '',
  } as React.InputHTMLAttributes<HTMLInputElement>;
}

/**
 * Сообщения для UI, объясняющие ограничения платформы.
 */
export const COMPAT_MESSAGES = {
  FIREFOX_STATUS: 'Firefox (дек. 2025): выбор папок через диалоговое окно работает неэффективно.',
  DND_REQUIRED: 'Для загрузки структуры используйте Drag-and-Drop.',
  DND_ADVICE: 'Это надёжнее и быстрее для больших проектов.',
} as const;
