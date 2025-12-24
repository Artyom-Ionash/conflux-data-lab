'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import React from 'react';

import { cn } from '@/core/tailwind/utils';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function Tooltip({ children, content, className, side = 'top' }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={5}
            className={cn(
              'animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 max-w-xs',
              'z-tooltip',
              'rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 shadow-xl backdrop-blur-sm',
              'text-[11px] leading-relaxed text-zinc-100',
              className
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-zinc-700" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export interface Zone {
  colorClass: string;
  percent: number;
}

export interface ZoneIndicatorProps {
  value: number;
  displayValue: string;
  max: number;
  zones: Zone[];
  markerColorClass: string; // Класс для цветной тени/свечения
  label?: string;
  tooltip?: React.ReactNode;
  className?: string;
}

export function ZoneIndicator({
  value,
  displayValue,
  max,
  zones,
  markerColorClass, // Используем для цветного "Glow" эффекта
  label,
  tooltip,
  className = '',
}: ZoneIndicatorProps) {
  const percentage = Math.max(0, Math.min((value / max) * 100, 100));

  // Оборачиваем весь индикатор или только полоску в Tooltip, если он передан
  const content = (
    <div className={`relative flex flex-col justify-center ${className}`}>
      {label && (
        <div className="mb-1.5 flex items-end justify-between px-0.5">
          <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
            {label}
          </span>
          <span className="rounded bg-zinc-800 px-1.5 font-mono text-[10px] font-bold text-zinc-200">
            {displayValue}
          </span>
        </div>
      )}

      {/* Bar Container */}
      <div className="relative isolate h-3 w-full cursor-help rounded-sm bg-zinc-900 shadow-inner">
        {/* Background Zones (Clipped) */}
        <div className="absolute inset-0 flex overflow-hidden rounded-sm opacity-90">
          {zones.map((zone, idx) => (
            <div
              key={idx}
              className={`bg-gradient-to-r ${zone.colorClass} border-r border-black/10 last:border-0`}
              style={{ flexBasis: `${zone.percent}%` }}
            />
          ))}
        </div>

        {/* Cursor Marker (High Contrast) */}
        <div
          className="absolute top-[-3px] bottom-[-3px] z-20 w-1.5 transition-all duration-300 ease-out will-change-[left]"
          style={{ left: `calc(${percentage}% - 3px)` }}
        >
          {/* The Needle itself: White with dark borders for max contrast */}
          <div className="h-full w-full rounded-[1px] border-x border-black/40 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.8)]" />

          {/* Colored Glow/Halo behind the needle */}
          <div
            className={`absolute inset-0 h-full w-full opacity-60 blur-[4px] transition-colors duration-300 ${markerColorClass}`}
          />
        </div>
      </div>
    </div>
  );

  // ПРИМЕНЕНИЕ СЕКАТОРА: Делегируем показ подсказки специализированному компоненту
  if (tooltip) {
    return (
      <Tooltip content={tooltip} side="top">
        {content}
      </Tooltip>
    );
  }

  return content;
}
