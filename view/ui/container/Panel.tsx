import React from 'react';

import { cn } from '@/core/tailwind/utils';

interface PanelHeaderProps {
  title: string;
  action?: React.ReactNode;
  className?: string;
}

export function PanelHeader({ title, action, className }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900',
        className
      )}
    >
      <span className="text-xs font-semibold text-zinc-500 uppercase">{title}</span>
      {action && <div>{action}</div>}
    </div>
  );
}
