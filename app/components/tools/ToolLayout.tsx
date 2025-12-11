'use client';

import * as ScrollArea from '@radix-ui/react-scroll-area';
import Link from 'next/link';
import React, { ReactNode } from 'react';

interface ToolLayoutProps {
  title: string;
  sidebar: ReactNode;
  children: ReactNode; // Это будет Canvas
}

export function ToolLayout({ title, sidebar, children }: ToolLayoutProps) {
  return (
    <div className="fixed inset-0 flex flex-row overflow-hidden bg-zinc-50 font-sans text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside className="z-20 flex w-80 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <ScrollArea.Root className="w-full flex-1 overflow-hidden bg-white dark:bg-zinc-900">
          <ScrollArea.Viewport className="h-full w-full p-5">
            {/* Header */}
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-200"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>{' '}
              На главную
            </Link>
            <h2 className="mb-6 text-xl font-bold">{title}</h2>

            {/* Sidebar Content */}
            {sidebar}
          </ScrollArea.Viewport>

          <ScrollArea.Scrollbar
            className="flex touch-none bg-zinc-100 p-0.5 transition-colors duration-[160ms] ease-out select-none hover:bg-zinc-200 data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:flex-col data-[orientation=vertical]:w-2.5 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            orientation="vertical"
          >
            <ScrollArea.Thumb className="relative flex-1 rounded-[10px] bg-zinc-300 before:absolute before:top-1/2 before:left-1/2 before:h-full before:min-h-[44px] before:w-full before:min-w-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-[''] dark:bg-zinc-600" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </aside>

      {/* Main Workspace */}
      <main className="relative flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
