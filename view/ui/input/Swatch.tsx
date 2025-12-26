'use client';

import React, { forwardRef } from 'react';

import { cn } from '@/core/tailwind/utils';

interface SwatchProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'interactive' | 'static';
}

export const Swatch = forwardRef<HTMLDivElement, SwatchProps>(
  ({ className, children, variant = 'static', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative h-8 w-8 flex-shrink-0 overflow-hidden rounded border bg-white dark:border-zinc-700',
          variant === 'interactive' && 'group cursor-crosshair',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Swatch.displayName = 'Swatch';
