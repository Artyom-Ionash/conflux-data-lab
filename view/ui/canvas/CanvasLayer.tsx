'use client';

import React, { forwardRef } from 'react';

import { cn } from '@/core/tailwind/utils';

interface CanvasLayerProps extends React.HTMLAttributes<HTMLDivElement> {
  isActive?: boolean;
}

export const CanvasLayer = forwardRef<HTMLDivElement, CanvasLayerProps>(
  ({ isActive, className, children, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'pointer-events-none absolute left-0 overflow-hidden border-r border-dashed border-zinc-300/30 transition-colors',
          className
        )}
        style={{
          zIndex: isActive ? 'var(--z-dropdown)' : 'var(--z-sticky)',
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CanvasLayer.displayName = 'CanvasLayer';
