export const HARDWARE_STANDARD_YEAR = '2025';

export const TEXTURE_LIMITS = {
  SAFE_MOBILE: 4096,
  SAFE_PC: 8192,
  MAX_BROWSER: 16_384,
  MAX_SLIDER: 20_000,
} as const;

// Цвета зон можно оставить здесь как константы конфигурации,
// так как они описывают бизнес-логику "зон опасности", а не стиль кнопки.
// Но лучше использовать семантические имена.
export const TEXTURE_ZONES = [
  { percent: 20.48, color: 'from-green-600 to-green-500' }, // Safe
  { percent: 20.48, color: 'from-yellow-500 to-yellow-400' }, // Warning
  { percent: 40.96, color: 'from-orange-500 to-orange-400' }, // Danger
  { percent: 18.08, color: 'from-red-600 to-red-500' }, // Critical
];

export type TextureStatus = 'safe' | 'warning' | 'danger' | 'critical';

export function isPowerOfTwo(x: number): boolean {
  return x > 0 && (x & (x - 1)) === 0;
}

export function getNearestPoT(x: number): number {
  return Math.pow(2, Math.round(Math.log(x) / Math.log(2)));
}

export function analyzeTextureSize(dimension: number) {
  if (dimension > TEXTURE_LIMITS.MAX_BROWSER) {
    return {
      status: 'critical' as TextureStatus,
      label: 'CRITICAL',
      icon: '⛔',
      message: `Превышен лимит браузера (${TEXTURE_LIMITS.MAX_BROWSER}px). Экспорт невозможен.`,
    };
  }
  if (dimension > TEXTURE_LIMITS.SAFE_PC) {
    return {
      status: 'danger' as TextureStatus,
      label: 'DANGER',
      icon: '☢️',
      message: `Только для мощных ПК (> ${TEXTURE_LIMITS.SAFE_PC}px).`,
    };
  }
  if (dimension > TEXTURE_LIMITS.SAFE_MOBILE) {
    return {
      status: 'warning' as TextureStatus,
      label: 'WARNING',
      icon: '⚠️',
      message: `Риск вылетов на мобильных (> ${TEXTURE_LIMITS.SAFE_MOBILE}px).`,
    };
  }
  return {
    status: 'safe' as TextureStatus,
    label: 'SAFE',
    icon: '✅',
    message: 'Безопасно для всех платформ.',
  };
}
