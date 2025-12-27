'use client';

import React from 'react';

import { cn } from '@/core/tailwind/utils';

interface ToolbarProps {
  children: React.ReactNode;
  className?: string;
  position?: 'top-center' | 'bottom-center';
}

export function Toolbar({ children, className, position = 'top-center' }: ToolbarProps) {
  const positionClasses = {
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={cn(
        'absolute z-(--z-canvas-ui) flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90',
        positionClasses[position],
        className
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarSeparator() {
  return <div className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-700" />;
}
