import React from 'react';

import { cn } from '@/core/tailwind/utils';

interface AlertProps {
  children: React.ReactNode;
  variant?: 'error' | 'warning' | 'info';
  className?: string;
}

const variants = {
  error: 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400',
  warning: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
};

export function Alert({ children, variant = 'error', className }: AlertProps) {
  return (
    <div className={cn('p-3 text-xs font-medium', variants[variant], className)}>{children}</div>
  );
}
