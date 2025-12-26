'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';

import { cn } from '@/core/tailwind/utils';

import { LimitBar, type LimitZone } from '../feedback/LimitBar';
import { Tooltip } from '../feedback/ZoneIndicator';
import { Button } from './Button';

// --- STYLES SYSTEM ---

const statusBadgeVariants = cva(
  'flex cursor-help items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase transition-colors',
  {
    variants: {
      status: {
        safe: 'border-green-800 bg-green-900/20 text-green-600 dark:text-green-400',
        warning: 'border-yellow-800 bg-yellow-900/20 text-yellow-600 dark:text-yellow-400',
        danger: 'border-orange-800 bg-orange-900/20 text-orange-600 dark:text-orange-400',
        critical: 'border-red-800 bg-red-900/20 text-red-600 dark:text-red-400',
      },
    },
    defaultVariants: {
      status: 'safe',
    },
  }
);

const sliderVariants = cva(
  'h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-200 focus:ring-2 focus:ring-blue-500/30 focus:outline-none dark:bg-zinc-700',
  {
    variants: {
      status: {
        safe: 'accent-green-500',
        warning: 'accent-yellow-500',
        danger: 'accent-orange-500',
        critical: 'accent-red-500',
      },
    },
    defaultVariants: {
      status: 'safe',
    },
  }
);

const markerVariants = cva('', {
  variants: {
    status: {
      safe: 'bg-green-500',
      warning: 'bg-yellow-500',
      danger: 'bg-orange-500',
      critical: 'bg-red-500',
    },
  },
  defaultVariants: {
    status: 'safe',
  },
});

// --- COMPONENT ---

interface DimensionInputProps extends VariantProps<typeof statusBadgeVariants> {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;

  // Logic Props
  isPoT: boolean;
  nearestPoT: number;
  onPoTClick: () => void;

  // Feedback Props
  statusIcon: string;
  statusLabel: string;
  message: React.ReactNode;

  // Visualization
  zones: LimitZone[];
  limitMax: number;

  disabled?: boolean;
  className?: string;
}

export function DimensionInput({
  label,
  value,
  min = 1,
  max = 16384,
  onChange,
  status,
  isPoT,
  nearestPoT,
  onPoTClick,
  statusIcon,
  statusLabel,
  message,
  zones,
  limitMax,
  disabled,
  className,
}: DimensionInputProps) {
  const percentage = Math.min((value / limitMax) * 100, 100);

  // Handlers
  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value));
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (!Number.isNaN(val)) onChange(Math.min(val, max || limitMax));
  };

  return (
    <div
      className={cn('flex flex-col gap-2', disabled && 'pointer-events-none opacity-50', className)}
    >
      {/* Header */}
      <div className="flex items-end justify-between">
        <label className="text-xs font-bold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          {label}
        </label>
        <Tooltip side="left" content={message}>
          <div className={statusBadgeVariants({ status })}>
            <span>{statusIcon}</span>
            <span>{statusLabel}</span>
          </div>
        </Tooltip>
      </div>

      {/* Inputs Row */}
      <div className="flex h-10 items-stretch gap-4">
        {/* Slider */}
        <div className="flex flex-1 items-center px-1">
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={handleSlider}
            className={sliderVariants({ status })}
          />
        </div>

        {/* PoT Control Group */}
        <div className="flex w-20 flex-col overflow-hidden rounded-lg shadow-sm">
          <Button
            onClick={onPoTClick}
            disabled={disabled}
            variant="outline"
            className={cn(
              'flex-1 rounded-none border-0 border-b border-zinc-200 text-[9px] font-bold tracking-wide uppercase dark:border-zinc-700',
              isPoT
                ? 'cursor-default bg-green-600 text-white hover:bg-green-600 hover:text-white'
                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
            )}
          >
            {isPoT ? '2ⁿ OK' : `2ⁿ → ${nearestPoT}`}
          </Button>

          <div className="flex flex-1 items-center bg-white px-1 dark:bg-zinc-900">
            <input
              type="number"
              value={value}
              onChange={handleInput}
              className="w-full appearance-none bg-transparent text-center font-mono text-xs font-bold text-zinc-800 focus:outline-none dark:text-zinc-200"
            />
          </div>
        </div>
      </div>

      {/* Limit Bar */}
      <LimitBar
        zones={zones}
        markerPosition={percentage}
        markerColorClass={markerVariants({ status })}
      />
    </div>
  );
}
