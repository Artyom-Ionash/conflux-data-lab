'use client';

import React from 'react';

import { cn } from '../infrastructure/standards';

interface SeparatorProps {
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

/**
 * Минималистичный разделитель для тулбаров и секций.
 */
export function Separator({ orientation = 'vertical', className = '' }: SeparatorProps) {
  return (
    <div
      className={cn(
        'shrink-0 bg-zinc-200 dark:bg-zinc-700',
        orientation === 'vertical' ? 'hidden h-6 w-px sm:block' : 'h-px w-full',
        className
      )}
    />
  );
}
