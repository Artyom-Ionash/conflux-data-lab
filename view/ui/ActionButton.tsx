'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';

import { cn } from './infrastructure/standards';

const actionButtonVariants = cva(
  'inline-flex items-center justify-center rounded transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 disabled:opacity-50',
  {
    variants: {
      variant: {
        subtle:
          'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700',
        mono: 'bg-zinc-100 font-mono text-[10px] font-bold text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700',
        destructive: 'text-zinc-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30',
      },
      size: {
        xs: 'px-1.5 py-0.5',
        sm: 'p-1.5',
      },
    },
    defaultVariants: {
      variant: 'subtle',
      size: 'sm',
    },
  }
);

interface ActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof actionButtonVariants> {
  icon?: React.ReactNode;
}

/**
 * Крошечные кнопки для тулбаров и списков.
 */
export function ActionButton({
  variant,
  size,
  className,
  children,
  icon,
  ...props
}: ActionButtonProps) {
  return (
    <button className={cn(actionButtonVariants({ variant, size }), className)} {...props}>
      {icon && <span className={cn(children && 'mr-1.5')}>{icon}</span>}
      {children}
    </button>
  );
}
