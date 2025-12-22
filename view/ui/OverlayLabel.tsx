'use client';

import React from 'react';

import { cn } from './infrastructure/standards';

interface OverlayLabelProps {
  children: React.ReactNode;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  variant?: 'dark' | 'accent';
  className?: string;
}

/**

 * Техническая метка для наложения поверх визуального контента.
 */
export function OverlayLabel({
  children,
  position = 'top-left',
  variant = 'dark',
  className = '',
}: OverlayLabelProps) {
  const positions = {
    'top-left': 'top-1 left-1',
    'top-right': 'top-1 right-1',
    'bottom-left': 'bottom-1 left-1',
    'bottom-right': 'bottom-1 right-1',
  };

  const variants = {
    dark: 'bg-black/60 text-white',
    accent: 'bg-blue-600 text-white',
  };

  return (
    <div
      className={cn(
        'pointer-events-none absolute z-20 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold shadow-sm backdrop-blur-sm transition-opacity duration-200 select-none',
        positions[position],
        variants[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
