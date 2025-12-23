import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';

import { TRANSPARENCY_PATTERN_CSS } from '../../../core/tailwind/utils';

const containerVariants = cva(
  'group relative cursor-pointer overflow-hidden rounded-lg border border-zinc-200 shadow-sm transition-transform hover:scale-105 dark:border-zinc-700',
  {
    variants: {
      size: {
        sm: 'h-6 w-6',
        md: 'h-8 w-8',
        lg: 'h-10 w-10',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

interface ColorInputProps extends VariantProps<typeof containerVariants> {
  value: string | null;
  onChange: (value: string) => void;
  allowTransparent?: boolean;
  onClear?: () => void;
  className?: string;
}

export function ColorInput({
  value,
  onChange,
  allowTransparent = false,
  onClear,
  className = '',
  size,
}: ColorInputProps) {
  const inputValue = value || '#ffffff';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={containerVariants({ size })}>
        <input
          type="color"
          className="absolute inset-0 z-10 h-[150%] w-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer opacity-0"
          value={inputValue}
          onInput={(e) => onChange(e.currentTarget.value)}
        />

        {/* Checkerboard pattern (фон) */}
        <div
          className="absolute inset-0 z-0 bg-white"
          style={{
            backgroundImage: TRANSPARENCY_PATTERN_CSS(),
            backgroundSize: '8px 8px',
            backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
          }}
        />

        {/* Слой цвета */}
        <div
          className="absolute inset-0 z-1 transition-colors duration-200"
          style={{ backgroundColor: value || 'transparent' }}
        />
      </div>

      {allowTransparent && onClear && value !== null && (
        <button
          onClick={onClear}
          className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800"
          title="Сбросить на прозрачный"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      )}
    </div>
  );
}
