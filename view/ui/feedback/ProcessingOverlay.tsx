'use client';

import React, { useEffect, useState } from 'react';

import { cn } from '@/core/tailwind/utils';
import { Icon } from '@/view/ui/primitive/Icon';

interface ProcessingOverlayProps {
  isVisible: boolean;
  message?: string;
  children?: React.ReactNode;
  className?: string;
}

export function ProcessingOverlay({
  isVisible,
  message,
  children,
  className = '',
}: ProcessingOverlayProps) {
  const [shouldRender, setShouldRender] = useState(isVisible);

  if (isVisible && !shouldRender) {
    setShouldRender(true);
  }

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isVisible) {
      timer = setTimeout(() => setShouldRender(false), 300);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isVisible]);

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        'z-overlay fx-cover fx-col-center gap-3 bg-white/40 transition-all duration-300 ease-in-out dark:bg-black/40',
        isVisible
          ? 'pointer-events-auto opacity-100 backdrop-blur-[1px]'
          : 'pointer-events-none opacity-0 backdrop-blur-none',
        className
      )}
    >
      {children ? (
        <div className="w-64 max-w-[80%] rounded-lg border border-zinc-200 bg-white/90 p-4 shadow-xl backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/90">
          {children}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200 bg-white/90 p-4 shadow-xl backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/90">
          <Icon.Spinner className="h-8 w-8 text-blue-600" />
          {message && <p className="text-xs font-medium text-zinc-500">{message}</p>}
        </div>
      )}
    </div>
  );
}
