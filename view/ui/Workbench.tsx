'use client';

import React from 'react';

import { cn } from './infrastructure/standards';

interface WorkbenchProps extends React.HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  className?: string;
}

const Root = ({ children, className, ...props }: WorkbenchProps) => (
  <div
    className={cn(
      'fixed inset-0 z-[100] flex overflow-hidden overscroll-none bg-zinc-50 dark:bg-zinc-950',
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
      'z-20 flex w-80 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900',
      className
    )}
    {...props}
  >
    <div className="custom-scrollbar flex-1 overflow-y-auto p-5">
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  </aside>
);

const Stage = ({ children, className, ...props }: WorkbenchProps) => (
  <main
    className={cn('relative z-10 flex-1 overflow-hidden overscroll-none', className)}
    {...props}
  >
    {children}
  </main>
);

const Toolbar = ({ children, className, ...props }: WorkbenchProps) => (
  <div
    className={cn(
      'absolute top-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white/90 p-2 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/90',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const Workbench = {
  Root,
  Sidebar,
  Stage,
  Toolbar,
};
