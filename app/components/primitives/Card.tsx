import Link from 'next/link';
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  href?: string;
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
  href,
  className = '',
  title,
  headerActions,
  contentClassName,
}: CardProps) {
  const hasHeader = Boolean(title || headerActions);
  const contentClasses = contentClassName ?? (hasHeader ? 'px-5 py-4' : 'p-6');
  const content = (
    <>
      {hasHeader && <CardHeader title={title} headerActions={headerActions} />}
      <div className={contentClasses}>{children}</div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={`${baseClasses} ${className}`}>
        {content}
      </Link>
    );
  }

  return <div className={`${baseClasses} ${className}`}>{content}</div>;
}
