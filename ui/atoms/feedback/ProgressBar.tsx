'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';

import { cn } from '@/core/tailwind/utils';

const progressContainerVariants = cva('w-full', {
  variants: {
    size: {
      sm: 'h-1',
      md: 'h-1.5',
      lg: 'h-2.5',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const barVariants = cva('h-full transition-all duration-300 ease-out rounded-full', {
  variants: {
    variant: {
      default: 'bg-blue-600',
      success: 'bg-green-600',
      warning: 'bg-yellow-500',
      critical: 'bg-red-600',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

const labelVariants = cva('text-xs font-semibold mb-1.5 flex justify-between', {
  variants: {
    variant: {
      default: 'text-blue-700 dark:text-blue-300',
      success: 'text-green-700 dark:text-green-300',
      warning: 'text-yellow-700 dark:text-yellow-300',
      critical: 'text-red-700 dark:text-red-300',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

export interface ProgressBarProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof barVariants>,
    VariantProps<typeof progressContainerVariants> {
  value: number; // Renamed from 'progress' to standard 'value'
  max?: number;
  label?: string;
  showValue?: boolean;
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  className,
  variant,
  size,
  ...props
}: ProgressBarProps) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div className={className} {...props}>
      {(label || showValue) && (
        <div className={labelVariants({ variant })}>
          {label && <span>{label}</span>}
          {showValue && <span className="font-mono">{Math.round(percentage)}%</span>}
        </div>
      )}
      <div
        className={cn(
          'overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800',
          progressContainerVariants({ size })
        )}
      >
        <div className={barVariants({ variant })} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
