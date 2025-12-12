import React from 'react';

interface ProcessingOverlayProps {
  isVisible: boolean;
  progress?: number; // 0-100. Если не передан — показывается спиннер
  message?: string;
  className?: string;
}

export function ProcessingOverlay({
  isVisible,
  progress,
  message,
  className = '',
}: ProcessingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div
      className={`absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/60 backdrop-blur-[2px] dark:bg-black/60 ${className}`}
    >
      {progress !== undefined ? (
        // Progress Bar Variant
        <div className="w-64 max-w-[80%] rounded-lg bg-white p-4 shadow-xl dark:bg-zinc-900">
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
        <div className="flex flex-col items-center gap-3 rounded-lg bg-white p-4 shadow-xl dark:bg-zinc-900">
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
