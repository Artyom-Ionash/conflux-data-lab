export const HARDWARE_STANDARD_YEAR = "2025";

export const TEXTURE_LIMITS = {
  SAFE_MOBILE: 4096,
  SAFE_PC: 8192,
  MAX_BROWSER: 16384,
  MAX_SLIDER: 20000,
} as const;

export const TEXTURE_ZONES = [
  { percent: 20.48, color: "from-green-600 to-green-500" },   // Safe
  { percent: 20.48, color: "from-yellow-500 to-yellow-400" }, // Warning
  { percent: 40.96, color: "from-orange-500 to-orange-400" }, // Danger
  { percent: 18.08, color: "from-red-600 to-red-500" },       // Critical
];

export type TextureStatus = 'safe' | 'warning' | 'danger' | 'critical';

export function isPowerOfTwo(x: number): boolean {
  return (x > 0) && ((x & (x - 1)) === 0);
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
      styles: {
        slider: 'accent-red-500',
        text: 'text-red-400',
        border: 'border-red-800',
        bg: 'bg-red-900/20',
        marker: 'bg-red-500'
      }
    };
  }
  if (dimension > TEXTURE_LIMITS.SAFE_PC) {
    return {
      status: 'danger' as TextureStatus,
      label: 'DANGER',
      icon: '☢️',
      message: `Только для мощных ПК (> ${TEXTURE_LIMITS.SAFE_PC}px).`,
      styles: {
        slider: 'accent-orange-500',
        text: 'text-orange-400',
        border: 'border-orange-800',
        bg: 'bg-orange-900/20',
        marker: 'bg-orange-500'
      }
    };
  }
  if (dimension > TEXTURE_LIMITS.SAFE_MOBILE) {
    return {
      status: 'warning' as TextureStatus,
      label: 'WARNING',
      icon: '⚠️',
      message: `Риск вылетов на мобильных (> ${TEXTURE_LIMITS.SAFE_MOBILE}px).`,
      styles: {
        slider: 'accent-yellow-500',
        text: 'text-yellow-400',
        border: 'border-yellow-800',
        bg: 'bg-yellow-900/20',
        marker: 'bg-yellow-500'
      }
    };
  }
  return {
    status: 'safe' as TextureStatus,
    label: 'SAFE',
    icon: '✅',
    message: 'Безопасно для всех платформ.',
    styles: {
      slider: 'accent-green-500',
      text: 'text-green-400',
      border: 'border-green-800',
      bg: 'bg-green-900/20',
      marker: 'bg-green-500'
    }
  };
}