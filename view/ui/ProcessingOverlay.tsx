'use client';

import React, { useEffect, useState } from 'react';

import { cn } from './infrastructure/standards';

// --- SUB-COMPONENT: ProgressBar ---
// Выделен внутри файла для соблюдения правила изоляции UI.

interface ProgressBarProps {
  progress: number;
  label?: string;
  showValue?: boolean;
  className?: string;
  variant?: 'blue' | 'green';
}

export function ProgressBar({
  progress,
  label,
  showValue = true,
  className = '',
  variant = 'blue',
}: ProgressBarProps) {
  const safeProgress = Math.max(0, Math.min(100, progress));

  const colors = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
  };

  const textColors = {
    blue: 'text-blue-700 dark:text-blue-300',
    green: 'text-green-700 dark:text-green-300',
  };

  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1.5 flex justify-between text-xs font-semibold">
          {label && <span className={textColors[variant]}>{label}</span>}
          {showValue && <span className="font-mono">{Math.round(safeProgress)}%</span>}
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className={cn('h-full transition-all duration-300 ease-out', colors[variant])}
          style={{ width: `${safeProgress}%` }}
        />
      </div>
    </div>
  );
}

// --- MAIN COMPONENT: ProcessingOverlay ---

interface ProcessingOverlayProps {
  isVisible: boolean;
  progress?: number;
  message?: string;
  className?: string;
}

export function ProcessingOverlay({
  isVisible,
  progress,
  message,
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
        'absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/40 transition-all duration-300 ease-in-out dark:bg-black/40',
        isVisible
          ? 'pointer-events-auto opacity-100 backdrop-blur-[1px]'
          : 'pointer-events-none opacity-0 backdrop-blur-none',
        className
      )}
    >
      {progress !== undefined ? (
        <div className="w-64 max-w-[80%] rounded-lg border border-zinc-200 bg-white/90 p-4 shadow-xl backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/90">
          <ProgressBar progress={progress} label={message || 'Обработка...'} />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-zinc-200 bg-white/90 p-4 shadow-xl backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/90">
          <svg
            className="h-8 w-8 animate-spin text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          {message && <p className="text-xs font-medium text-zinc-500">{message}</p>}
        </div>
      )}
    </div>
  );
}
