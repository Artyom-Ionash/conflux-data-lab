'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import React, { forwardRef } from 'react';

import { type ElementProps } from '@/core/react/props';
import { cn } from '@/core/tailwind/utils';

// --- FLEX SYSTEM (Stack & Group) ---

const flexVariants = cva('flex min-w-0', {
  variants: {
    direction: {
      row: 'flex-row',
      col: 'flex-col',
    },
    items: {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
    },
    justify: {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
    },
    wrap: {
      true: 'flex-wrap',
      false: 'flex-nowrap',
    },
    fullWidth: {
      true: 'w-full',
      false: '',
    },
  },
  defaultVariants: {
    items: 'stretch',
    justify: 'start',
    wrap: false,
    fullWidth: true,
  },
});

type FlexVariants = VariantProps<typeof flexVariants>;

interface FlexProps extends ElementProps<HTMLDivElement>, Omit<FlexVariants, 'direction'> {
  /** Gap between items (Tailwind units if number, CSS value if string) */
  gap?: number | string;
}

/**
 * Вертикальный стек. Аналог Flex Column.
 */
export const Stack = forwardRef<HTMLDivElement, FlexProps>(
  ({ children, gap = 4, items, justify, wrap, fullWidth, className, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(flexVariants({ direction: 'col', items, justify, wrap, fullWidth }), className)}
      style={{
        gap: typeof gap === 'number' ? `${gap * 0.25}rem` : gap,
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
 * Горизонтальная группа. Аналог Flex Row.
 */
export const Group = forwardRef<HTMLDivElement, FlexProps>(
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
      className={cn(flexVariants({ direction: 'row', items, justify, wrap, fullWidth }), className)}
      style={{
        gap: typeof gap === 'number' ? `${gap * 0.25}rem` : gap,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
);
Group.displayName = 'Group';

// --- GRID SYSTEM ---

interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Количество колонок (cols-N). Если не указано, используется className или auto-flow */
  cols?: number | string;
  /** Отступ (gap-N) */
  gap?: number;
  /** Растягивание элементов */
  items?: 'start' | 'center' | 'end' | 'stretch';
}

/**
 * Обертка над CSS Grid.
 * Для адаптивности используйте className (например: "grid-cols-1 lg:grid-cols-3")
 * и не передавайте проп `cols`.
 */
export const Grid = forwardRef<HTMLDivElement, GridProps>(
  ({ children, cols, gap = 4, items, className, style, ...props }, ref) => {
    // Генерируем инлайн-стиль только если cols передан явно.
    // Это позволяет классам Tailwind (lg:grid-cols-N) работать без конфликтов.
    const gridTemplateColumns =
      cols !== undefined
        ? typeof cols === 'number'
          ? `repeat(${cols}, minmax(0, 1fr))`
          : cols
        : undefined;

    return (
      <div
        ref={ref}
        className={cn('grid', items && `items-${items}`, className)}
        style={{
          gap: `${gap * 0.25}rem`,
          gridTemplateColumns,
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Grid.displayName = 'Grid';
