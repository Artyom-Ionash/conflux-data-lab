'use client';

import Link from 'next/link';
import React from 'react';

import { cn } from '@/core/tailwind/utils';
import { Icon } from '@/ui/atoms/primitive/Icon';
import { Button } from '@/ui/molecules/input/Button';

interface WorkbenchProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string;
}

const Root = ({ children, className, ...props }: WorkbenchProps) => (
  <div
    className={cn(
      'z-base fixed inset-0 flex overflow-hidden overscroll-none bg-zinc-50 dark:bg-zinc-950',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

const Sidebar = ({ children, className, ...props }: WorkbenchProps) => (
  <aside
    className={cn(
      'z-workbench-sidebar flex w-80 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900',
      className
    )}
    {...props}
  >
    <div className="fx-scrollbar flex-1 overflow-x-hidden overflow-y-auto p-5">
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  </aside>
);

const Header = ({ title, className }: { title: string; className?: string }) => (
  <div className={cn('flex flex-col gap-4', className)}>
    <Link
      href="/"
      className="inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
    >
      <Icon.ArrowLeft className="h-3.5 w-3.5" />
      <span>На главную</span>
    </Link>
    <h2 className="text-xl font-bold tracking-tight">{title}</h2>
  </div>
);

const Stage = ({ children, className, ...props }: WorkbenchProps) => (
  <main
    className={cn('z-base relative flex-1 overflow-hidden overscroll-none', className)}
    {...props}
  >
    {children}
  </main>
);

/**
 * Внутренняя область Stage с автоматическими отступами и скроллом.
 */
const Content = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('h-full w-full space-y-4 overflow-y-auto p-4', className)}>{children}</div>
);

// --- EMPTY STATE SYSTEM ---

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}

/**
 * Стандартизированный компонент "Пустое состояние".
 * Используется когда в инструменте еще нет данных.
 */
const EmptyState = ({
  title,
  description,
  icon,
  action,
  onAction,
  actionLabel,
  className,
}: EmptyStateProps) => {
  return (
    <div className={cn('fx-col-center h-full w-full p-6', className)}>
      <div className="fx-col-center w-full max-w-md gap-6 text-center">
        {/* Icon Circle */}
        <div className="fx-center h-20 w-20 rounded-2xl bg-zinc-100 shadow-inner ring-1 ring-zinc-200 dark:bg-zinc-800/50 dark:ring-zinc-700">
          {icon || <Icon.Placeholder className="h-10 w-10 text-zinc-400 dark:text-zinc-500" />}
        </div>

        {/* Text Content */}
        <div className="space-y-2">
          <h3 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {title}
          </h3>
          {description && (
            <p className="text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
              {description}
            </p>
          )}
        </div>

        {/* Action Area */}
        {(action || (onAction && actionLabel)) && (
          <div className="mt-2">
            {action || (
              <Button onClick={onAction} size="lg" className="shadow-lg">
                {actionLabel}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const Workbench = {
  Root,
  Sidebar,
  Header,
  Stage,
  Content,
  EmptyState,
};
