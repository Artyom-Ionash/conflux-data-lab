'use client';

import React, { useMemo } from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Slider, SliderStatusColor } from '../../ui/Slider';

// --- CONSTANTS (Hardware Standards 2025) ---
const LIMIT_SAFE_MOBILE = 4096;
const LIMIT_SAFE_PC = 8192;
const LIMIT_MAX_BROWSER = 16384;

// --- UTILS ---
function isPowerOfTwo(x: number) {
  return (x > 0) && ((x & (x - 1)) === 0);
}

function getNearestPoT(x: number) {
  return Math.pow(2, Math.round(Math.log(x) / Math.log(2)));
}

interface TextureDimensionSliderProps {
  value: number;
  onChange: (val: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
}

export const TextureDimensionSlider = (props: TextureDimensionSliderProps) => {
  const { value, onChange } = props;

  const isPoT = useMemo(() => isPowerOfTwo(value), [value]);
  const nearestPoT = useMemo(() => getNearestPoT(value || 1), [value]);

  const { status, message } = useMemo<{ status: 'safe' | 'warning' | 'danger' | 'critical'; message: React.ReactNode }>(() => {
    if (value > LIMIT_MAX_BROWSER) {
      return {
        status: 'critical',
        message: (
          <>
            <div className="font-bold text-red-200 mb-1">⛔ Технический лимит браузера</div>
            <div className="mb-1">Сторона превышает {LIMIT_MAX_BROWSER}px. Canvas не может отрисовать такое изображение, экспорт заблокирован.</div>
            <div className="opacity-60 text-[10px] uppercase tracking-wider">Ограничение движков (2025 г.)</div>
          </>
        )
      };
    }
    if (value > LIMIT_SAFE_PC) {
      return {
        status: 'danger',
        message: (
          <>
            <div className="font-bold text-orange-200 mb-1">☢️ Только для мощного железа</div>
            <div className="mb-1">Сторона {'>'} {LIMIT_SAFE_PC}px. Поддерживается только на High-End ПК и современных консолях. Не подходит для мобильных игр.</div>
            <div className="opacity-60 text-[10px] uppercase tracking-wider">Стандарт 2025 г.</div>
          </>
        )
      };
    }
    if (value > LIMIT_SAFE_MOBILE) {
      return {
        status: 'warning',
        message: (
          <>
            <div className="font-bold text-yellow-200 mb-1">⚠️ Риск для мобильных устройств</div>
            <div className="mb-1">Сторона {'>'} {LIMIT_SAFE_MOBILE}px. Возможны вылеты приложений на бюджетных и старых смартфонах из-за нехватки видеопамяти.</div>
            <div className="opacity-60 text-[10px] uppercase tracking-wider">Стандарт 2025 г.</div>
          </>
        )
      };
    }
    return { status: 'safe', message: null };
  }, [value]);

  // Маппинг логического статуса на цвет UI-компонента
  let sliderColor: SliderStatusColor = 'blue';
  if (status === 'critical') sliderColor = 'red';
  else if (status === 'danger') sliderColor = 'orange';
  else if (status === 'warning') sliderColor = 'yellow';
  else if (isPoT) sliderColor = 'green'; // Если всё ок и PoT — зеленый

  const headerRight = (
    <div className="flex items-center gap-2">
      {/* 1. Предупреждение (если есть) */}
      {status !== 'safe' && (
        <Tooltip.Provider delayDuration={0}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button className="cursor-help hover:scale-110 p-0.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-transform focus:outline-none">
                {status === 'warning' && <span role="img" aria-label="warning">⚠️</span>}
                {status === 'danger' && <span role="img" aria-label="danger">☢️</span>}
                {status === 'critical' && <span role="img" aria-label="critical">⛔</span>}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                className="z-50 max-w-[260px] bg-zinc-900 text-zinc-100 text-xs p-3 rounded-lg shadow-xl border border-zinc-700 leading-relaxed select-none animate-in fade-in zoom-in-95 duration-200"
                side="top" sideOffset={5} align="start"
              >
                {message}
                <Tooltip.Arrow className="fill-zinc-900" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      )}

      {/* 2. Кнопка Power of Two */}
      {value > 0 && (
        <Tooltip.Provider delayDuration={200}>
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                onClick={() => onChange(nearestPoT)}
                className={`
                  text-[9px] font-bold px-1.5 py-0.5 rounded border transition-all select-none
                  ${isPoT
                    ? 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800 cursor-default'
                    : 'bg-zinc-100 text-zinc-400 border-zinc-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:bg-zinc-800 dark:text-zinc-500 dark:border-zinc-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-300'
                  }
                `}
              >
                {isPoT ? '2ⁿ OK' : `2ⁿ ➝ ${nearestPoT}`}
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="z-50 bg-zinc-800 text-zinc-300 text-[10px] p-2 rounded border border-zinc-700" side="top">
                {isPoT
                  ? 'Размер кратен степени двойки. Идеально для GPU.'
                  : `Нажмите, чтобы округлить до ${nearestPoT}px (эффективно для памяти)`}
                <Tooltip.Arrow className="fill-zinc-800" />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>
      )}
    </div>
  );

  return (
    <Slider
      {...props}
      statusColor={sliderColor}
      headerRight={headerRight}
    />
  );
};