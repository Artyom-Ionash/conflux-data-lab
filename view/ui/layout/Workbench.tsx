'use client';

import Link from 'next/link';
import React from 'react';

import { cn } from '@/core/tailwind/utils';

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
    <div className="custom-scrollbar flex-1 overflow-y-auto p-5">
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
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
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

/**
 * Стандартный контейнер для плейсхолдеров, когда данные ещё не загружены.
 */
const EmptyStage = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('flex h-full w-full items-center justify-center p-8', className)}>
    <div className="w-full max-w-2xl">{children}</div>
  </div>
);

export const Workbench = {
  Root,
  Sidebar,
  Header,
  Stage,
  Content,
  EmptyStage,
};
