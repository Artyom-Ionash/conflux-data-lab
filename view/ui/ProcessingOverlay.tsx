'use client';

import React, { useEffect, useState } from 'react';

import { cn } from './infrastructure/standards';

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

  // ПАТТЕРН: Обновление состояния во время рендера (Derived State).
  // Если проп isVisible стал true, а мы еще не рендеримся — включаем немедленно.
  // React прервет текущий рендер и запустит новый с обновленным стейтом ДО отрисовки в браузере.
  // Это устраняет мигание и удовлетворяет линтер, так как мы не используем useEffect для этого.
  if (isVisible && !shouldRender) {
    setShouldRender(true);
  }

  useEffect(() => {
    let timer: NodeJS.Timeout;

    // Логика задержки нужна только при скрытии (isVisible = false)
    if (!isVisible) {
      timer = setTimeout(() => setShouldRender(false), 300);
    }

    // Очистка таймера обязательна
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
        // Progress Bar Variant
        <div className="w-64 max-w-[80%] rounded-lg border border-zinc-200 bg-white/90 p-4 shadow-xl backdrop-blur-sm dark:border-zinc-700 dark:bg-zinc-900/90">
          <div className="mb-2 flex justify-between text-xs font-semibold text-zinc-700 dark:text-zinc-200">
            <span>{message || 'Обработка...'}</span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        // Spinner Variant
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
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          {message && <p className="text-xs font-medium text-zinc-500">{message}</p>}
        </div>
      )}
    </div>
  );
}
