import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';

import { cn } from './infrastructure/standards';

// 1. Описываем стили декларативно.
// CVA автоматически генерирует типы для вариантов.
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
        primary: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
        secondary: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        destructive: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

// 2. Наследуем стандартные HTML атрибуты + варианты CVA
export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  // cn() склеит базовые стили + вариант + ваш внешний className
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
