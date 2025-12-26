'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';

import { cn } from '@/core/tailwind/utils';

const indicatorVariants = cva(
  'inline-flex items-center gap-2 rounded border px-2 py-1 font-mono text-[10px] leading-none shadow-sm transition-colors cursor-default select-none',
  {
    variants: {
      variant: {
        default: 'border-zinc-800 bg-zinc-900 text-zinc-100 dark:border-zinc-700 dark:bg-black',
        accent: 'border-blue-900 bg-blue-950 text-blue-100 dark:border-blue-800',
        critical: 'border-red-900 bg-red-950 text-red-100 dark:border-red-800',
        ghost: 'border-transparent bg-transparent text-zinc-600 dark:text-zinc-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface IndicatorProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof indicatorVariants> {
  label?: React.ReactNode;
}

/**
 * Примитив для отображения технических метрик (Time, Size, Range).
 * Эстетика: Industrial / HUD / Sci-Fi.
 */
export function Indicator({ children, label, variant, className, ...props }: IndicatorProps) {
  return (
    <div className={cn(indicatorVariants({ variant }), className)} {...props}>
      {label && (
        <>
          <span className="font-bold tracking-wider uppercase opacity-50">{label}</span>
          {/* Вертикальный разделитель */}
          <span className="h-2 w-px bg-current opacity-20" />
        </>
      )}
      <span className="font-bold">{children}</span>
    </div>
  );
}
