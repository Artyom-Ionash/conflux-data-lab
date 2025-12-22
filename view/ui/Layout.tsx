'use client';

import React from 'react';

import { cn } from './infrastructure/standards';

interface LayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  gap?: number | string;
  items?: 'start' | 'center' | 'end' | 'baseline' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  wrap?: boolean;
  fullWidth?: boolean;
}

/**
 * Вертикальный контейнер для построения ритма интерфейса.
 */
export function Stack({
  children,
  gap = 4,
  items = 'stretch',
  justify = 'start',
  fullWidth = true,
  className,
  style,
  ...props
}: LayoutProps) {
  return (
    <div
      className={cn('flex flex-col', fullWidth && 'w-full', className)}
      style={{
        gap: typeof gap === 'number' ? `${gap * 0.25}rem` : gap,
        alignItems: items,
        justifyContent: justify,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Горизонтальный контейнер для выстраивания элементов в ряд.
 */
export function Group({
  children,
  gap = 2,
  items = 'center',
  justify = 'start',
  wrap = false,
  fullWidth = false,
  className,
  style,
  ...props
}: LayoutProps) {
  return (
    <div
      className={cn('flex flex-row', wrap && 'flex-wrap', fullWidth && 'w-full', className)}
      style={{
        gap: typeof gap === 'number' ? `${gap * 0.25}rem` : gap,
        alignItems: items,
        justifyContent: justify,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
