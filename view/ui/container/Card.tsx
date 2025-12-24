import { Slot } from '@radix-ui/react-slot';
import type { ReactNode } from 'react';

import { type PolymorphicProps } from '@/core/react/props';

interface CardProps extends Omit<PolymorphicProps<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  headerActions?: ReactNode;
  contentClassName?: string;
}

const baseClasses = [
  'block rounded-xl border border-zinc-200/80 bg-white/95 shadow-sm',
  'transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md',
  'dark:border-zinc-800 dark:bg-zinc-900/90',
].join(' ');

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
  ...props // Remaining native attributes (id, style, etc.)
}: CardProps) {
  const Comp = asChild ? Slot : 'div';
  const hasHeader = Boolean(title || headerActions);
  const contentClasses = contentClassName ?? (hasHeader ? 'px-5 py-4' : 'p-6');

  return (
    <Comp className={`${baseClasses} ${className}`} {...props}>
      {/* 
          If asChild is true, the user is responsible for rendering the header 
          inside the child component if needed, or we only use Card for styling.
          Standard mode renders the structure: 
      */}
      {!asChild && hasHeader && <CardHeader title={title} headerActions={headerActions} />}
      <div className={!asChild ? contentClasses : undefined}>{children}</div>
    </Comp>
  );
}
