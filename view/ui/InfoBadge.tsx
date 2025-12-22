'use client';

import React from 'react';

import { cn } from './infrastructure/standards';

interface InfoBadgeProps {
  children: React.ReactNode;
  label?: string;
  className?: string;
}

/**
 * Высококонтрастная моноширинная метка для технических данных (размеры, время, счетчики).
 */
export function InfoBadge({ children, label, className = '' }: InfoBadgeProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded bg-black/80 px-2.5 py-1 font-mono text-[10px] font-bold text-white shadow-sm dark:bg-white/10',
        className
      )}
    >
      {label && <span className="tracking-tighter uppercase opacity-50">{label}</span>}
      <span className="whitespace-nowrap">{children}</span>
    </div>
  );
}
