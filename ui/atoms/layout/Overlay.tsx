'use client';

import React from 'react';

import { cn } from '@/core/tailwind/utils';

interface OverlayProps {
  children: React.ReactNode;
  className?: string;
  center?: boolean; // Центрировать контент?
  dim?: boolean; // Затемнять фон?
  visible?: boolean; // Управление видимостью (opacity/pointer-events)
  gradient?: 'bottom' | 'top' | 'none'; // Градиентная подложка для текста
}

export function Overlay({
  children,
  className,
  center = false,
  dim = false,
  visible = true,
  gradient = 'none',
}: OverlayProps) {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 z-(--z-overlay) transition-opacity duration-200', // Заменено z-10 на семантический слой
        center && 'flex items-center justify-center',
        dim && 'bg-black/50 backdrop-blur-sm',
        gradient === 'bottom' && 'bg-gradient-to-t from-black/80 to-transparent',
        gradient === 'top' && 'bg-gradient-to-b from-black/80 to-transparent',
        !visible && 'opacity-0',
        visible && 'opacity-100',
        className
      )}
    >
      {/* Включаем pointer-events для детей, если оверлей видим */}
      <div className={cn(visible ? 'pointer-events-auto' : 'pointer-events-none')}>{children}</div>
    </div>
  );
}
