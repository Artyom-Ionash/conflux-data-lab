'use client';

import * as SliderPrimitive from '@radix-ui/react-slider';
import React, { useRef } from 'react';

import { cn } from '@/core/tailwind/utils';

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  /**
   * thumbIndex передается эвристически (определяем, какое значение изменилось).
   * Это нужно для предпросмотра конкретного кадра при перетаскивании.
   */
  onValueChange: (value: [number, number], thumbIndex?: 0 | 1) => void;
  minStepsBetweenThumbs?: number;
  className?: string;
  formatTooltip?: (value: number) => string;
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  minStepsBetweenThumbs = 0,
  className = '',
  formatTooltip,
}: RangeSliderProps) {
  // Храним предыдущее значение, чтобы понять, какой ползунок сдвинулся
  const prevValueRef = useRef<[number, number]>(value);

  const handleValueChange = (newValues: number[]) => {
    // FIX: Безопасное извлечение значений без приведения типа (as)
    const v0 = newValues[0];
    const v1 = newValues[1];

    // Гарантируем кортеж [number, number]. Если undefined - берем min/max
    const next: [number, number] = [v0 ?? min, v1 ?? max];
    const prev = prevValueRef.current;

    let changedIndex: 0 | 1 | undefined;
    if (next[0] !== prev[0]) changedIndex = 0;
    else if (next[1] !== prev[1]) changedIndex = 1;

    prevValueRef.current = next;
    onValueChange(next, changedIndex);
  };

  const renderThumb = (val: number, index: 0 | 1) => {
    const isMin = index === 0;
    const label = isMin ? 'Start' : 'End';

    return (
      <SliderPrimitive.Thumb
        key={index}
        className={cn(
          'group/thumb relative block h-4 w-4 rounded-full border-2 bg-white shadow-md transition-transform duration-75 hover:scale-110 focus:ring-2 focus:outline-none',
          isMin ? 'border-blue-500 focus:ring-blue-500' : 'border-purple-500 focus:ring-purple-500'
        )}
        aria-label={label}
      >
        {/* Tooltip (появляется при наведении или фокусе/драге) */}
        <div className="absolute top-0 left-1/2 z-30 mb-2 -translate-x-1/2 -translate-y-[140%] scale-0 opacity-0 transition-all duration-150 group-hover/thumb:scale-100 group-hover/thumb:opacity-100 group-focus/thumb:scale-100 group-focus/thumb:opacity-100 group-active/thumb:scale-100 group-active/thumb:opacity-100">
          <div className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[10px] whitespace-nowrap text-white shadow-lg">
            <span className="font-bold">{formatTooltip ? formatTooltip(val) : val.toFixed(2)}</span>
            <span
              className={cn(
                'text-[9px] font-bold tracking-wide uppercase',
                isMin ? 'text-blue-400' : 'text-purple-400'
              )}
            >
              {isMin ? '← Start' : 'End →'}
            </span>
          </div>
          {/* Стрелка тултипа */}
          <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-r border-b border-zinc-700 bg-zinc-900" />
        </div>
      </SliderPrimitive.Thumb>
    );
  };

  return (
    <SliderPrimitive.Root
      className={cn('relative flex h-6 w-full touch-none items-center select-none', className)}
      value={value}
      min={min}
      max={max}
      step={step}
      minStepsBetweenThumbs={minStepsBetweenThumbs}
      onValueChange={handleValueChange}
    >
      <SliderPrimitive.Track className="relative h-1.5 grow rounded-full bg-zinc-200 dark:bg-zinc-800">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-blue-500 opacity-80 dark:bg-blue-600" />
      </SliderPrimitive.Track>

      {renderThumb(value[0], 0)}
      {renderThumb(value[1], 1)}
    </SliderPrimitive.Root>
  );
}
