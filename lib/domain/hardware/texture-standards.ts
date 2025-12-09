// --- TYPES ---

export type TextureStatus = 'safe' | 'warning' | 'danger' | 'critical';

export interface TextureAnalysisResult {
  status: TextureStatus;
  message: string;
  shortLabel: string;
  colors: {
    bg: string;     // Цвет фона бейджа/индикатора в тултипе
    text: string;   // Цвет текста
    marker: string; // Цвет свечения курсора (Tailwind класс)
  };
}

// --- CONSTANTS ---

export const HARDWARE_STANDARD_YEAR = "2025";

export const TEXTURE_LIMITS = {
  SAFE_MOBILE: 4096,    // Лимит большинства мобильных GPU
  SAFE_PC: 8192,        // Лимит большинства интегрированных GPU и старых видеокарт
  MAX_BROWSER: 16384,   // Типичный лимит текстуры в Chrome/Firefox (GL_MAX_TEXTURE_SIZE)
  MAX_VISUALIZER: 20000 // Максимум для шкалы отображения
} as const;

// Конфигурация зон для UI
export const TEXTURE_UI_ZONES = [
  { colorClass: "from-emerald-600 to-emerald-500", percent: 20.48 }, // Safe
  { colorClass: "from-yellow-500 to-yellow-400", percent: 20.48 },   // Warning
  { colorClass: "from-orange-500 to-orange-400", percent: 40.96 },   // Danger
  { colorClass: "from-red-600 to-red-500", percent: 18.08 },         // Critical
];

// --- LOGIC ---

export function analyzeTextureSize(dimension: number): TextureAnalysisResult {
  if (dimension > TEXTURE_LIMITS.MAX_BROWSER) {
    return {
      status: 'critical',
      shortLabel: 'UNSTABLE',
      message: `Размер > ${TEXTURE_LIMITS.MAX_BROWSER}px. Высокий риск сбоя браузера (OOM) или потери WebGL контекста при экспорте.`,
      colors: { bg: 'bg-red-500', text: 'text-red-500', marker: 'shadow-red-500/50' }
    };
  }
  
  if (dimension > TEXTURE_LIMITS.SAFE_PC) {
    return {
      status: 'danger',
      shortLabel: 'HEAVY',
      message: `Размер > ${TEXTURE_LIMITS.SAFE_PC}px. Требует много видеопамяти. Может не открыться на ноутбуках и слабых ПК.`,
      colors: { bg: 'bg-orange-500', text: 'text-orange-500', marker: 'shadow-orange-500/50' }
    };
  }
  
  if (dimension > TEXTURE_LIMITS.SAFE_MOBILE) {
    return {
      status: 'warning',
      shortLabel: 'DESKTOP ONLY',
      message: `Размер > ${TEXTURE_LIMITS.SAFE_MOBILE}px. Не подходит для мобильных браузеров (iOS/Android ограничены 4096px).`,
      colors: { bg: 'bg-yellow-500', text: 'text-yellow-500', marker: 'shadow-yellow-500/50' }
    };
  }

  return {
    status: 'safe',
    shortLabel: 'UNIVERSAL',
    message: `Размер ≤ ${TEXTURE_LIMITS.SAFE_MOBILE}px. Полная совместимость (Mobile, Tablet, Desktop).`,
    colors: { bg: 'bg-emerald-500', text: 'text-emerald-500', marker: 'shadow-emerald-500/50' }
  };
}