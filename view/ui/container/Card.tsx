import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';

import { type PolymorphicProps } from '@/core/react/props';
import { cn } from '@/core/tailwind/utils';

const cardVariants = cva('block rounded-xl border transition-all duration-200 shadow-sm', {
  variants: {
    variant: {
      default:
        'border-zinc-200/80 bg-white/95 hover:-translate-y-[1px] hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/90',
      ghost: 'border-transparent bg-transparent shadow-none',
      outline: 'border-zinc-200 bg-transparent dark:border-zinc-800',
    },
    active: {
      true: 'border-blue-400 bg-blue-50/80 ring-1 ring-blue-400 dark:border-blue-700 dark:bg-blue-900/40 dark:ring-blue-700',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'default',
    active: false,
  },
});

interface CardProps
  extends Omit<PolymorphicProps<HTMLDivElement>, 'title'>, VariantProps<typeof cardVariants> {
  title?: ReactNode;
  headerActions?: ReactNode;
  contentClassName?: string;
}

function CardHeader({ title, headerActions }: Pick<CardProps, 'title' | 'headerActions'>) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-3 dark:border-zinc-800">
      <div className="text-sm leading-tight font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </div>
      {headerActions && (
        <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-300">
          {headerActions}
        </div>
      )}
    </div>
  );
}

export function Card({
  children,
  asChild = false,
  className = '',
  title,
  headerActions,
  contentClassName,
  variant,
  active,
  ...props
}: CardProps) {
  const Comp = asChild ? Slot : 'div';
  const hasHeader = Boolean(title || headerActions);
  const contentClasses = contentClassName ?? (hasHeader ? 'px-5 py-4' : 'p-6');

  if (asChild) {
    return (
      <Comp className={cn(cardVariants({ variant, active }), className)} {...props}>
        {children}
      </Comp>
    );
  }

  return (
    <div className={cn(cardVariants({ variant, active }), className)} {...props}>
      {hasHeader && <CardHeader title={title} headerActions={headerActions} />}
      <div className={contentClasses}>{children}</div>
    </div>
  );
}
