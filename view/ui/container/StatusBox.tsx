'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';

import { cn } from '../_infrastructure/standards';

const statusBoxVariants = cva('rounded-lg border p-4 transition-all duration-300', {
  variants: {
    variant: {
      info: 'border-blue-100 bg-blue-50 text-blue-800 dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-200',
      warning:
        'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800/40 dark:bg-yellow-900/20 dark:text-yellow-200',
      success:
        'border-green-100 bg-green-50 text-green-800 dark:border-green-900/30 dark:bg-green-900/10 dark:text-green-200',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
});

interface StatusBoxProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof statusBoxVariants> {
  title?: string;
}

/**
 * Контейнер для выделения важных состояний или групп настроек в сайдбаре.
 */
export function StatusBox({ title, variant, className, children, ...props }: StatusBoxProps) {
  return (
    <div className={cn(statusBoxVariants({ variant }), className)} {...props}>
      {title && (
        <p className="mb-3 text-[10px] font-bold tracking-widest uppercase opacity-80">{title}</p>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
