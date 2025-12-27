'use client';

import { cva } from 'class-variance-authority';
import React from 'react';

import { cn } from '@/core/tailwind/utils';

export interface LimitZone {
  percent: number;
  color: string;
}

interface LimitBarProps {
  zones: LimitZone[];
  markerPosition: number; // 0-100
  markerColorClass?: string;
  className?: string;
}

const markerVariants = cva(
  'absolute top-0 bottom-0 -ml-1 w-2 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.5)] ring-1 ring-white/80 transition-all duration-75 ease-out'
);

export function LimitBar({ zones, markerPosition, markerColorClass, className }: LimitBarProps) {
  return (
    <div
      className={cn(
        'relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800',
        className
      )}
    >
      {/* Background Zones */}
      <div className="absolute inset-0 flex opacity-80">
        {zones.map((zone, i) => (
          <div
            key={i}
            className={cn('h-full bg-gradient-to-r', zone.color)}
            style={{ width: `${zone.percent}%` }}
          />
        ))}
      </div>

      {/* Cursor */}
      <div
        className={cn(markerVariants(), markerColorClass)}
        style={{ left: `${markerPosition}%` }}
      />
    </div>
  );
}
