'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import React, { forwardRef } from 'react';

import { cn } from './infrastructure/standards';

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

interface FlexProps extends React.HTMLAttributes<HTMLDivElement>, Omit<FlexVariants, 'direction'> {
  children: React.ReactNode;
  /** Отступ между элементами (умножается на 0.25rem, как в Tailwind) */
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
      // Group по умолчанию выравнивает по центру
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

// --- GRID SYSTEM (Columns) ---

// ОПТИМИЗАЦИЯ: Оставляем только то, что используется в проекте.
// 1 - дефолт
// 2 - используется в ToolGrid (нативно, но полезно иметь здесь)
// 3 - используется в VideoFrameExtractor
// Все остальное (4, 5, 12...) пойдет через inline-style fallback.
const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
};

const MD_GRID_COLS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
};

const LG_GRID_COLS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
};

interface ColumnsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  count?: number;
  tablet?: number;
  desktop?: number;
  gap?: number;
}

/**
 * Адаптивная сетка.
 * Использует классы Tailwind для стандартов (1-3 колонки) и inline-styles для нестандарта.
 */
export const Columns = forwardRef<HTMLDivElement, ColumnsProps>(
  ({ children, count = 1, tablet, desktop, gap = 4, className, style, ...props }, ref) => {
    // 1. Пытаемся найти класс в мапе
    const baseClass = GRID_COLS[count];
    const tabletClass = tablet ? MD_GRID_COLS[tablet] : '';
    const desktopClass = desktop ? LG_GRID_COLS[desktop] : '';

    // 2. Базовые стили
    const dynamicStyle: React.CSSProperties = {
      gap: `${gap * 0.25}rem`,
      ...style,
    };

    // 3. Fallback: Если класса нет (например count=4), генерируем inline стиль
    // Это избавляет от необходимости раздувать мапу GRID_COLS
    if (!baseClass) {
      dynamicStyle.gridTemplateColumns = `repeat(${count}, minmax(0, 1fr))`;
    }

    return (
      <div
        ref={ref}
        className={cn('grid w-full', baseClass || '', tabletClass, desktopClass, className)}
        style={dynamicStyle}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Columns.displayName = 'Columns';
