import { Slot } from '@radix-ui/react-slot';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  asChild?: boolean;
  className?: string;
  title?: ReactNode;
  headerActions?: ReactNode;
  /** Дополнительные классы для обертки контента */
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
}: CardProps) {
  const Comp = asChild ? Slot : 'div';
  const hasHeader = Boolean(title || headerActions);
  const contentClasses = contentClassName ?? (hasHeader ? 'px-5 py-4' : 'p-6');

  // Если asChild=true, мы рендерим Slot, который передает пропсы единственному ребенку.
  // Но нам нужно также отрендерить Header и внутренний padding.
  // Slot предполагает, что мы передаем *только* ребенка.
  // ПАТТЕРН: Если мы хотим обернуть Link в Card, Link должен быть корневым элементом.
  // Значит, Header должен быть *внутри* Link или Link должен быть *внутри* Card?
  // Обычно Card как ссылка означает, что ВСЯ карточка кликабельна.

  if (asChild) {
    return (
      <Comp className={`${baseClasses} ${className}`}>
        {/* Slot мерджит пропсы (включая className) с ребенком */}
        {/* Мы ожидаем, что ребенок примет children (контент карточки) */}
        {children}
      </Comp>
    );
  }

  // Стандартный режим
  return (
    <div className={`${baseClasses} ${className}`}>
      {hasHeader && <CardHeader title={title} headerActions={headerActions} />}
      <div className={contentClasses}>{children}</div>
    </div>
  );
}
