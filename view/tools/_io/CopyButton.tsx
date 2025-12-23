'use client';

import React from 'react';

import { cn } from '@/view/ui/infrastructure/standards';
import { Button, type ButtonProps } from '@/view/ui/input/Button';

interface CopyButtonProps extends Omit<ButtonProps, 'onClick'> {
  onCopy: () => void;
  isCopied: boolean;
  label?: string;
  successLabel?: string;
}

/**
 * Умная кнопка копирования.
 * Обертка над Button, управляющая состоянием иконки и текста.
 */
export function CopyButton({
  onCopy,
  isCopied,
  variant = 'outline', // Дефолт теперь outline, так как в Button это стандарт
  size = 'sm',
  className,
  label = 'Копировать',
  successLabel = 'Готово!',
  ...props
}: CopyButtonProps) {
  return (
    <Button
      onClick={(e) => {
        e.preventDefault();
        onCopy();
      }}
      variant={isCopied ? 'outline' : variant}
      size={size}
      className={cn(
        'transition-all duration-200',
        isCopied && 'border-green-500 text-green-600 hover:text-green-700 dark:text-green-400',
        className
      )}
      disabled={isCopied}
      {...props}
    >
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
      <span>{isCopied ? successLabel : label}</span>
    </Button>
  );
}
