'use client';

import React from 'react';

import { cn } from './infrastructure/standards';

interface WorkbenchProps {
  children: React.ReactNode;
  className?: string;
}

// FIX: Используем fixed позиционирование.
// inset-x-0 bottom-0: Прибиваем к низу и бокам.
// top-[65px]: Отступаем место под глобальный хедер (его высота ~65px).
// Это гарантирует, что футер (который внизу страницы) окажется ПОД верстаком и не вызовет скролл.
const Root = ({ children, className }: WorkbenchProps) => (
  <div
    className={cn(
      'fixed inset-x-0 top-[65px] bottom-0 flex overflow-hidden bg-zinc-50 dark:bg-zinc-950',
      className
    )}
  >
    {children}
  </div>
);

const Sidebar = ({ children, className }: WorkbenchProps) => (
  <aside
    className={cn(
      'z-20 flex w-80 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900',
      className
    )}
  >
    <div className="custom-scrollbar flex-1 overflow-y-auto p-5">
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  </aside>
);

const Stage = ({ children, className }: WorkbenchProps) => (
  // overscroll-none: Предотвращает "эластичный" скролл всей страницы на Mac/Mobile при зуме канваса
  <main className={cn('relative z-10 flex-1 overflow-hidden overscroll-none', className)}>
    {children}
  </main>
);

const Toolbar = ({ children, className }: WorkbenchProps) => (
  <div
    className={cn(
      'absolute top-4 right-4 z-50 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white/90 p-2 shadow-sm backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/90',
      className
    )}
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
