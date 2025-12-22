'use client';

import React, { forwardRef } from 'react';

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
export const Stack = forwardRef<HTMLDivElement, LayoutProps>(
  (
    {
      children,
      gap = 4,
      items = 'stretch',
      justify = 'start',
      fullWidth = true,
      className,
      style,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
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
  )
);
Stack.displayName = 'Stack';

/**
 * Горизонтальный контейнер для выстраивания элементов в ряд.
 */
export const Group = forwardRef<HTMLDivElement, LayoutProps>(
  (
    {
      children,
      gap = 2,
      items = 'center',
      justify = 'start',
      wrap = false,
      fullWidth = false,
      className,
      style,
      ...props
    },
    ref
  ) => (
    <div
      ref={ref}
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
  )
);
Group.displayName = 'Group';

/**
 * [КРИСТАЛЛ] Columns
 * Сетка для распределения контента по колонкам.
 */
export const Columns = forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    count?: number;
    tablet?: number;
    desktop?: number;
    gap?: number;
  } & React.HTMLAttributes<HTMLDivElement>
>(({ children, count = 1, tablet, desktop, gap = 4, className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'grid w-full',
      count === 1 ? 'grid-cols-1' : `grid-cols-${count}`,
      tablet && `md:grid-cols-${tablet}`,
      desktop && `lg:grid-cols-${desktop}`,
      className
    )}
    style={{ gap: `${gap * 0.25}rem` }}
    {...props}
  >
    {children}
  </div>
));
Columns.displayName = 'Columns';
