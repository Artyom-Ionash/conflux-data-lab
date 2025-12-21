'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';

import { cn } from './infrastructure/standards';

const copyButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-zinc-100 px-3 py-1.5 text-xs text-zinc-900 hover:bg-zinc-200 focus:ring-zinc-400',
        primary: 'bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700 focus:ring-blue-500',
        subtle:
          'bg-zinc-100 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700',
        link: 'p-0 text-xs text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300',
      },
      isCopied: {
        true: 'scale-100',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

interface CopyButtonProps extends VariantProps<typeof copyButtonVariants> {
  onCopy: () => void;
  isCopied: boolean;
  className?: string;
  label?: string;
  successLabel?: string;
}

/**
 * Презентационный компонент для унификации кнопок копирования.
 */
export function CopyButton({
  onCopy,
  isCopied,
  variant,
  className,
  label = 'Копировать',
  successLabel = 'Готово!',
}: CopyButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        onCopy();
      }}
      className={cn(
        copyButtonVariants({ variant, isCopied }),
        isCopied && 'text-green-600 dark:text-green-400',
        className
      )}
      disabled={isCopied}
    >
      <div className="relative flex items-center gap-1.5">
        {/* Иконка */}
        {isCopied ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
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
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}

        {/* Текст */}
        <span className="transition-all duration-200">{isCopied ? successLabel : label}</span>
      </div>
    </button>
  );
}
