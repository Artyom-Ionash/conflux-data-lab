'use client';

import React from 'react';

import { cn } from '@/core/tailwind/utils';

interface LegendItemProps {
  color: string; // Tailwind class, e.g., "bg-red-500"
  label: string;
  className?: string;
}

export function LegendItem({ color, label, className }: LegendItemProps) {
  return (
    <div className={cn('flex items-center gap-1.5 text-[10px] font-medium select-none', className)}>
      <div className={cn('h-2 w-2 rounded-full shadow-sm', color)} />
      <span className="opacity-90">{label}</span>
    </div>
  );
}
