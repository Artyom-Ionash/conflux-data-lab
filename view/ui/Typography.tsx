'use client';

import React from 'react';

import { cn } from './infrastructure/standards';

interface TextProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'error' | 'secondary' | 'dimmed' | 'white';
  size?: 'xs' | 'sm' | 'md';
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
}

/**
 * Унифицированный контроль над текстовыми элементами системы.
 */
export const Typography = {
  Text: ({
    variant = 'default',
    size = 'sm',
    align = 'left',
    bold = false,
    className,
    ...props
  }: TextProps) => {
    const variants = {
      default: 'text-zinc-900 dark:text-zinc-100',
      error: 'text-red-600 dark:text-red-500 font-medium',
      secondary: 'text-zinc-500 dark:text-zinc-400',
      dimmed: 'text-zinc-400 dark:text-zinc-500',
      white: 'text-white',
    };

    const sizes = {
      xs: 'text-[10px] leading-tight',
      sm: 'text-xs',
      md: 'text-sm',
    };

    return (
      <span
        className={cn(
          variants[variant],
          sizes[size],
          bold && 'font-bold',
          align === 'center' && 'block text-center',
          align === 'right' && 'block text-right',
          className
        )}
        {...props}
      />
    );
  },
};
