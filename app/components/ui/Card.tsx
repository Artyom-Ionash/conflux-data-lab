import Link from 'next/link';
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  href?: string;
  className?: string;
  title?: ReactNode;
  headerActions?: ReactNode;
  /** Дополнительные классы для обертки контента */
  contentClassName?: string;
}

export function Card({
  children,
  href,
  className = '',
  title,
  headerActions,
  contentClassName
}: CardProps) {
  const baseClasses = [
    'block rounded-xl border border-zinc-200/80 bg-white/95 shadow-sm',
    'transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md',
    'dark:border-zinc-800 dark:bg-zinc-900/90'
  ].join(' ');
  const hasHeader = Boolean(title || headerActions);
  const contentClasses = contentClassName ?? (hasHeader ? 'px-5 py-4' : 'p-6');

  if (href) {
    return (
      <Link href={href} className={`${baseClasses} ${className}`}>
        {hasHeader && (
          <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200/80 dark:border-zinc-800">
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 leading-tight">
              {title}
            </div>
            {headerActions && (
              <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-300">
                {headerActions}
              </div>
            )}
          </div>
        )}
        <div className={contentClasses}>
          {children}
        </div>
      </Link>
    );
  }

  return (
    <div className={`${baseClasses} ${className}`}>
      {hasHeader && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200/80 dark:border-zinc-800">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 leading-tight">
            {title}
          </div>
          {headerActions && (
            <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-300">
              {headerActions}
            </div>
          )}
        </div>
      )}
      <div className={contentClasses}>
        {children}
      </div>
    </div>
  );
}


