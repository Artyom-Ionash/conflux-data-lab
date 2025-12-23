'use client';

import React, { forwardRef, useId } from 'react';

import { ControlLabel } from '@/view/ui/ControlSection';
import { cn } from '@/view/ui/infrastructure/standards';
import { Stack } from '@/view/ui/Layout';

// --- STYLES ---

// Единый стиль для всех полей ввода в проекте
const INPUT_BASE_STYLES = cn(
  'w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs shadow-sm transition-all',
  'placeholder:text-zinc-400 dark:placeholder:text-zinc-600',
  'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
  // Standardized Focus Ring
  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
  // Disabled State
  'disabled:cursor-not-allowed disabled:opacity-50'
);

const ERROR_STYLES = 'border-red-500 focus:border-red-500 focus:ring-red-500/20';

// --- COMPONENTS ---

interface FieldProps {
  label: React.ReactNode;
  children: React.ReactElement<{ id?: string }>;
  className?: string;
  error?: string;
  id?: string;
}

export function Field({ label, children, className, error, id: customId }: FieldProps) {
  const generatedId = useId();
  const id = customId || generatedId;

  return (
    <Stack gap={1.5} className={className}>
      <label htmlFor={id} className="cursor-pointer select-none">
        <ControlLabel>{label}</ControlLabel>
      </label>
      {/* Клонируем ребенка, чтобы насильно прокинуть ему ID для связи с Label */}
      {React.cloneElement(children, { id })}
      {error && (
        <span className="animate-in slide-in-from-top-1 text-[10px] font-bold text-red-500 uppercase">
          {error}
        </span>
      )}
    </Stack>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(INPUT_BASE_STYLES, error && ERROR_STYLES, className)}
        {...props}
      />
    );
  }
);
TextInput.displayName = 'TextInput';

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          INPUT_BASE_STYLES,
          'custom-scrollbar resize-none',
          error && ERROR_STYLES,
          className
        )}
        {...props}
      />
    );
  }
);
TextArea.displayName = 'TextArea';
