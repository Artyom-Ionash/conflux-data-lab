/**
 * [LEGACY] Инструменты для поддержки устаревших API и специфических ограничений браузеров.
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
 * Константы уведомлений для проблемных зон.
 */
export const LEGACY_MESSAGES = {
  FIREFOX_STATUS: 'Firefox (дек. 2025): выбор папок через диалоговое окно работает неэффективно.',
  DND_REQUIRED: 'Для загрузки структуры используйте Drag-and-Drop.',
  DND_ADVICE: 'Это надёжнее и быстрее для больших проектов.',
} as const;
