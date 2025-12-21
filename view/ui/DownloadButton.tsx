'uuse client';

import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';

import { cn } from './infrastructure/standards';

const downloadButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-zinc-900 px-4 py-2 text-sm text-white hover:opacity-90 dark:bg-white dark:text-black',
        primary: 'bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 focus:ring-blue-500',
        subtle:
          'bg-zinc-100 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
        link: 'p-0 text-xs text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface DownloadButtonProps extends VariantProps<typeof downloadButtonVariants> {
  onDownload: () => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * [КРИСТАЛЛ] DownloadButton
 * Унифицированная кнопка для всех операций экспорта файлов.
 */
export function DownloadButton({
  onDownload,
  variant,
  className,
  label = 'Скачать',
  disabled,
}: DownloadButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        onDownload();
      }}
      className={cn(downloadButtonVariants({ variant }), className)}
      disabled={disabled}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      <span>{label}</span>
    </button>
  );
}
