'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';

import { cn } from '../infrastructure/standards';

const textVariants = cva('', {
  variants: {
    variant: {
      default: 'text-zinc-900 dark:text-zinc-100',
      secondary: 'text-zinc-500 dark:text-zinc-400',
      dimmed: 'text-zinc-400 dark:text-zinc-500',
      error: 'text-red-600 dark:text-red-500 font-medium',
      white: 'text-white',
      // Специальный вариант для замены ControlLabel
      label: 'text-[10px] font-bold tracking-wider text-zinc-500 uppercase dark:text-zinc-400',
    },
    size: {
      xs: 'text-[10px] leading-tight',
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
      xl: 'text-lg font-semibold',
    },
    align: {
      left: 'text-left',
      center: 'text-center block',
      right: 'text-right block',
    },
    weight: {
      normal: 'font-normal',
      medium: 'font-medium',
      bold: 'font-bold',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'sm',
    align: 'left',
    weight: 'normal',
  },
});

interface TextProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof textVariants> {
  // Legacy prop support
  bold?: boolean;
}

export const Typography = {
  Text: ({ variant, size, align, weight, bold, className, ...props }: TextProps) => {
    // Маппинг для обратной совместимости
    const effectiveWeight = weight || (bold ? 'bold' : 'normal');

    return (
      <span
        className={cn(textVariants({ variant, size, align, weight: effectiveWeight }), className)}
        {...props}
      />
    );
  },
};
