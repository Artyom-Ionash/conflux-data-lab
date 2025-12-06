'use client';

import React, { ReactNode } from 'react';
import * as ScrollArea from '@radix-ui/react-scroll-area';

interface ToolLayoutProps {
  title: string;
  sidebar: ReactNode;
  children: ReactNode; // Это будет Canvas
}

export function ToolLayout({ title, sidebar, children }: ToolLayoutProps) {
  return (
    <div className="fixed inset-0 flex flex-row overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
      <aside className="z-20 flex w-80 flex-shrink-0 flex-col border-r border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <ScrollArea.Root className="flex-1 w-full overflow-hidden bg-white dark:bg-zinc-900">
          <ScrollArea.Viewport className="w-full h-full p-5">

            {/* Header */}
            <a href="/" className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg> На главную
            </a>
            <h2 className="mb-6 text-xl font-bold">{title}</h2>

            {/* Sidebar Content */}
            {sidebar}

          </ScrollArea.Viewport>

          <ScrollArea.Scrollbar className="flex select-none touch-none p-0.5 bg-zinc-100 dark:bg-zinc-800 transition-colors duration-[160ms] ease-out hover:bg-zinc-200 dark:hover:bg-zinc-700 data-[orientation=vertical]:w-2.5 data-[orientation=horizontal]:flex-col data-[orientation=horizontal]:h-2.5" orientation="vertical">
            <ScrollArea.Thumb className="flex-1 bg-zinc-300 dark:bg-zinc-600 rounded-[10px] relative before:content-[''] before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-full before:h-full before:min-w-[44px] before:min-h-[44px]" />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      </aside>

      {/* Main Workspace */}
      <main className="relative flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}