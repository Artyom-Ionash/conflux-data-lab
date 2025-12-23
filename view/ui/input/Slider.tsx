'use client';

import * as SliderPrimitive from '@radix-ui/react-slider';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import React from 'react';

import { cn } from '../_infrastructure/standards';

// --- ОПРЕДЕЛЕНИЕ СТИЛЕЙ ---

// 1. Стили для Track (полоски)
const trackVariants = cva('relative h-[4px] grow rounded-full transition-colors duration-300', {
  variants: {
    statusColor: {
      blue: 'bg-blue-500 dark:bg-blue-600',
      green: 'bg-green-500 dark:bg-green-600',
      yellow: 'bg-yellow-500',
      orange: 'bg-orange-500',
      red: 'bg-red-600',
    },
  },
  defaultVariants: { statusColor: 'blue' },
});

// 2. Стили для Thumb (ползунка)
const thumbVariants = cva(
  'block h-4 w-4 rounded-full border bg-white shadow-md transition-all duration-200 hover:scale-110 focus:ring-2 focus:outline-none focus:ring-offset-2',
  {
    variants: {
      statusColor: {
        blue: 'border-zinc-300 focus:ring-blue-500',
        green: 'border-green-300 focus:ring-green-500',
        yellow: 'border-yellow-500 focus:ring-yellow-500',
        orange: 'border-orange-500 focus:ring-orange-500',
        red: 'border-red-600 focus:ring-red-600',
      },
    },
    defaultVariants: { statusColor: 'blue' },
  }
);

// 3. Стили для Лейбла
const labelVariants = cva('text-xs font-bold tracking-wider uppercase transition-colors', {
  variants: {
    statusColor: {
      blue: 'text-zinc-500 dark:text-zinc-400',
      green: 'text-zinc-500 dark:text-zinc-400',
      yellow: 'text-yellow-600 dark:text-yellow-500',
      orange: 'text-orange-600 dark:text-orange-500',
      red: 'text-red-600 dark:text-red-400',
    },
  },
  defaultVariants: { statusColor: 'blue' },
});

// 4. Стили для Инпута
const inputVariants = cva(
  'h-7 w-16 rounded border bg-white px-1 text-right text-sm font-medium shadow-sm transition-colors focus:outline-none dark:bg-zinc-800',
  {
    variants: {
      statusColor: {
        blue: 'border-zinc-200 text-zinc-900 dark:border-zinc-700 dark:text-zinc-100',
        green: 'border-zinc-200 text-zinc-900 dark:border-zinc-700 dark:text-zinc-100',
        yellow: 'border-yellow-500 text-yellow-700',
        orange: 'border-orange-500 text-orange-700',
        red: 'border-red-600 text-red-700',
      },
    },
    defaultVariants: { statusColor: 'blue' },
  }
);

// --- КОМПОНЕНТ ---

interface SliderProps extends VariantProps<typeof trackVariants> {
  value: number;
  onChange: (val: number) => void;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  headerRight?: ReactNode;
  className?: string;
  disabled?: boolean;
}

export const Slider = ({
  value,
  onChange,
  label,
  min = 0,
  max = 100,
  step = 1,
  statusColor, // CVA сам распарсит этот проп
  headerRight,
  className = '',
  disabled = false,
}: SliderProps) => {
  return (
    <div className={cn('mb-4 flex flex-col gap-2', disabled && 'opacity-60 grayscale', className)}>
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-2">
          <label className={labelVariants({ statusColor })}>{label}</label>
          {headerRight}
        </div>

        <input
          type="number"
          value={value}
          onChange={(e) => !disabled && onChange(Number(e.target.value))}
          disabled={disabled}
          className={inputVariants({ statusColor })}
        />
      </div>

      <SliderPrimitive.Root
        className={cn(
          'relative flex h-6 w-full cursor-pointer touch-none items-center select-none',
          disabled && 'cursor-not-allowed'
        )}
        value={[value]}
        max={max}
        min={min}
        step={step}
        disabled={disabled}
        onValueChange={(val) => onChange(val[0] ?? value)}
      >
        <SliderPrimitive.Track className="relative h-[4px] grow rounded-full bg-zinc-200 dark:bg-zinc-700">
          <SliderPrimitive.Range className={trackVariants({ statusColor })} />
        </SliderPrimitive.Track>

        {/* CVA не умеет скрывать элементы, поэтому условный рендеринг оставляем */}
        {!disabled && (
          <SliderPrimitive.Thumb className={thumbVariants({ statusColor })} aria-label={label} />
        )}
      </SliderPrimitive.Root>
    </div>
  );
};
