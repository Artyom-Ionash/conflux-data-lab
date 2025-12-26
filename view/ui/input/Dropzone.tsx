'use client';

import React, { forwardRef } from 'react';

import { cn } from '@/core/tailwind/utils';

export interface DropzoneVisualProps extends React.HTMLAttributes<HTMLDivElement> {
  isDragActive?: boolean;
  isWarning?: boolean;
  label?: string;
  subLabel?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const DropzoneVisual = forwardRef<HTMLDivElement, DropzoneVisualProps>(
  ({ isDragActive, isWarning, label, subLabel, icon, children, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden transition-all duration-300',
          'rounded-xl border-2 border-dashed',
          isDragActive
            ? 'scale-[1.01] border-blue-500 bg-blue-50/50 dark:bg-blue-500/10'
            : isWarning
              ? 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10'
              : 'border-zinc-300 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50',
          className
        )}
        {...props}
      >
        {children || (
          <div className="pointer-events-none flex flex-col items-center justify-center px-6 py-7 text-center">
            {icon || (
              <svg
                className={cn(
                  'mb-3 h-9 w-9 transition-colors duration-300',
                  isDragActive ? 'text-blue-500' : isWarning ? 'text-amber-500/70' : 'text-zinc-400'
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            )}

            <div className="space-y-1">
              <p
                className={cn(
                  'text-xs font-bold tracking-tight uppercase transition-colors',
                  isWarning
                    ? 'text-amber-700 dark:text-amber-400'
                    : 'text-zinc-500 dark:text-zinc-400'
                )}
              >
                {isDragActive ? 'Бросайте файлы' : label}
              </p>
              {subLabel}
            </div>
          </div>
        )}
      </div>
    );
  }
);

DropzoneVisual.displayName = 'DropzoneVisual';
