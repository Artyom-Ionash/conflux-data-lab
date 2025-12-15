'use client';

import * as SliderPrimitive from '@radix-ui/react-slider';
import type { ReactNode } from 'react';
import React from 'react';

export type SliderStatusColor = 'blue' | 'green' | 'yellow' | 'orange' | 'red';

interface SliderProps {
  value: number;
  onChange: (val: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  statusColor?: SliderStatusColor;
  headerRight?: ReactNode;
  className?: string;
  disabled?: boolean; // <-- Добавлен проп disabled
}

export const Slider = ({
  value,
  onChange,
  label,
  min = 0,
  max = 100,
  step = 1,
  statusColor = 'blue',
  headerRight,
  className = '',
  disabled = false, // <-- Значение по умолчанию
}: SliderProps) => {
  const trackColors: Record<SliderStatusColor, string> = {
    blue: 'bg-blue-500 dark:bg-blue-600',
    green: 'bg-green-500 dark:bg-green-600',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    red: 'bg-red-600',
  };

  const thumbColors: Record<SliderStatusColor, string> = {
    blue: 'border-zinc-300 focus:ring-blue-500',
    green: 'border-green-300 focus:ring-green-500',
    yellow: 'border-yellow-500 focus:ring-yellow-500',
    orange: 'border-orange-500 focus:ring-orange-500',
    red: 'border-red-600 focus:ring-red-600',
  };

  const textColors: Record<SliderStatusColor, string> = {
    blue: 'text-zinc-500 dark:text-zinc-400',
    green: 'text-zinc-500 dark:text-zinc-400',
    yellow: 'text-yellow-600 dark:text-yellow-500',
    orange: 'text-orange-600 dark:text-orange-500',
    red: 'text-red-600 dark:text-red-400',
  };

  const inputColors: Record<SliderStatusColor, string> = {
    blue: 'border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100',
    green: 'border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100',
    yellow: 'border-yellow-500 text-yellow-700',
    orange: 'border-orange-500 text-orange-700',
    red: 'border-red-600 text-red-700',
  };

  return (
    <div
      className={`mb-4 flex flex-col gap-2 ${className} ${disabled ? 'opacity-60 grayscale' : ''}`}
    >
      <div className="flex items-end justify-between">
        {/* Левая часть: Лейбл + Доп контент */}
        <div className="flex items-center gap-2">
          <label
            className={`text-xs font-bold tracking-wider uppercase transition-colors ${textColors[statusColor]}`}
          >
            {label}
          </label>
          {headerRight}
        </div>

        {/* Правая часть: Инпут */}
        <input
          type="number"
          value={value}
          onChange={(e) => !disabled && onChange(Number(e.target.value))}
          disabled={disabled}
          className={`h-7 w-16 rounded border bg-white px-1 text-right text-sm font-medium shadow-sm transition-colors focus:outline-none dark:bg-zinc-800 ${inputColors[statusColor]}`}
        />
      </div>

      <SliderPrimitive.Root
        className={`group relative flex h-6 w-full cursor-pointer touch-none items-center select-none ${disabled ? 'cursor-not-allowed' : ''}`}
        value={[value]}
        max={max}
        min={min}
        step={step}
        disabled={disabled}
        onValueChange={(val) => onChange(val[0] ?? value)}
      >
        <SliderPrimitive.Track className="relative h-[4px] grow rounded-full bg-zinc-200 dark:bg-zinc-700">
          <SliderPrimitive.Range
            className={`absolute h-full rounded-full transition-colors duration-300 ${trackColors[statusColor]}`}
          />
        </SliderPrimitive.Track>

        {/* Скрываем Thumb, если disabled */}
        <SliderPrimitive.Thumb
          className={` ${disabled ? 'hidden' : 'block'} h-4 w-4 rounded-full border bg-white shadow-md transition-all duration-200 hover:scale-110 focus:ring-2 focus:outline-none ${thumbColors[statusColor]} `}
          aria-label={label}
        />
      </SliderPrimitive.Root>
    </div>
  );
};
