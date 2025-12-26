'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { type AsChildProps } from '@/core/react/props';
import { cn } from '@/core/tailwind/utils';

// --- 1. CONFIGURATION ---

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-zinc-900 text-zinc-50 shadow hover:bg-zinc-900/90 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-50/90',
        destructive:
          'bg-red-50 text-red-700 shadow-sm hover:bg-red-100 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50',
        outline:
          'border border-zinc-300 bg-white shadow-sm hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
        secondary:
          'bg-zinc-100 text-zinc-900 shadow-sm hover:bg-zinc-200/80 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:bg-zinc-700',
        ghost:
          'hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50',
        link: 'text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-50',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'h-9 w-9',
        xs: 'h-6 rounded px-2 text-[10px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

// --- 2. BASE COMPONENT ---

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    AsChildProps,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  }
);
Button.displayName = 'Button';

// --- 3. EXTENSIONS (UTILITY BUTTONS) ---

interface CopyButtonProps extends Omit<ButtonProps, 'onClick'> {
  onCopy: () => void;
  isCopied: boolean;
  label?: string;
  successLabel?: string;
}

/**
 * Специализированная кнопка для копирования.
 * Живет здесь же, чтобы не плодить файлы.
 */
function CopyButton({
  onCopy,
  isCopied,
  variant = 'outline',
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
      <span>{isCopied ? successLabel : label}</span>
    </Button>
  );
}

export { Button, buttonVariants, CopyButton };
