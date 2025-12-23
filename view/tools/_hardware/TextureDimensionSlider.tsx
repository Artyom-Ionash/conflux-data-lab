import React from 'react';

import {
  analyzeTextureSize,
  getNearestPoT,
  HARDWARE_STANDARD_YEAR,
  isPowerOfTwo,
  TEXTURE_LIMITS,
  TEXTURE_ZONES,
} from '@/lib/modules/graphics/standards';
import { cn } from '@/view/ui/_infrastructure/standards';
import { Tooltip } from '@/view/ui/feedback/ZoneIndicator';

interface TextureDimensionSliderProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  max?: number;
  disabled?: boolean;
}

export function TextureDimensionSlider({
  label,
  value,
  onChange,
  max = TEXTURE_LIMITS.MAX_SLIDER,
  disabled = false,
}: TextureDimensionSliderProps) {
  const { label: statusLabel, icon, message, styles } = analyzeTextureSize(value);
  const isPoT = isPowerOfTwo(value);
  const nearestPoT = getNearestPoT(value || 1);

  const percentage = Math.min((value / max) * 100, 100);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (!Number.isNaN(val)) onChange(Math.min(val, max));
  };

  const handlePoTClick = () => {
    if (!isPoT && !disabled) {
      onChange(nearestPoT);
    }
  };

  return (
    <div
      className={cn('relative flex flex-col gap-2', disabled && 'pointer-events-none opacity-50')}
    >
      {/* Header Label */}
      <div className="flex items-end justify-between">
        <label className="text-xs font-bold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          {label}
        </label>

        {/* ПРИМЕНЕНИЕ СЕКАТОРА: Замена ручного стейта на универсальный Tooltip */}
        <Tooltip
          side="left"
          content={
            <div className="space-y-1">
              <div className="font-medium">{message}</div>
              <div className="text-[10px] font-bold tracking-wider uppercase opacity-50">
                Hardware Standards {HARDWARE_STANDARD_YEAR}
              </div>
            </div>
          }
        >
          <div
            className={cn(
              'flex cursor-help items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-colors',
              styles.bg,
              styles.border,
              styles.text
            )}
          >
            <span>{icon}</span>
            <span>{statusLabel}</span>
          </div>
        </Tooltip>
      </div>

      {/* Main Controls Row */}
      <div className="flex h-10 items-stretch gap-4">
        {/* Slider Input (Transparent Container) */}
        <div className="flex flex-1 items-center px-1">
          <input
            type="range"
            min={1}
            max={max}
            value={value}
            onChange={handleSliderChange}
            className={cn(
              'h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 focus:ring-2 focus:ring-blue-500/30 focus:outline-none dark:bg-zinc-700',
              styles.slider
            )}
          />
        </div>

        {/* Input & PoT Group */}
        <div className="flex w-20 flex-col overflow-hidden rounded-lg shadow-sm">
          {/* PoT Button (Top half) */}
          <button
            onClick={handlePoTClick}
            disabled={disabled}
            className={cn(
              'flex flex-1 items-center justify-center rounded-t-lg border border-b-0 text-[9px] font-bold tracking-wide uppercase transition-all',
              isPoT
                ? 'cursor-default border-green-600 bg-green-600/90 text-white'
                : 'border-zinc-200 bg-zinc-100 text-zinc-500 hover:border-blue-600 hover:bg-blue-600 hover:text-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
            )}
          >
            {isPoT ? '2ⁿ OK' : `2ⁿ → ${nearestPoT}`}
          </button>

          {/* Number Input (Bottom half) */}
          <div className="flex flex-1 items-center rounded-b-lg border border-zinc-200 bg-white px-1 dark:border-zinc-700 dark:bg-zinc-900">
            <input
              type="number"
              value={value}
              onChange={handleInputChange}
              className="w-full appearance-none bg-transparent text-center font-mono text-xs font-bold text-zinc-800 focus:outline-none dark:text-zinc-200"
            />
          </div>
        </div>
      </div>

      {/* Visual Bar (Mini Zone Indicator) */}
      <div className="relative mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        {/* Background Zones */}
        <div className="absolute inset-0 flex opacity-80">
          {TEXTURE_ZONES.map((zone, i) => (
            <div
              key={i}
              className={cn('h-full bg-gradient-to-r', zone.color)}
              style={{ width: `${zone.percent}%` }}
            />
          ))}
        </div>

        {/* Cursor */}
        <div
          className={cn(
            'absolute top-0 bottom-0 -ml-1 w-2 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.5)] ring-1 ring-white/80 transition-all duration-75 ease-out',
            styles.marker
          )}
          style={{ left: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
