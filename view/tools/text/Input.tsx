'use client';

import React, { forwardRef, useId } from 'react';

import { ControlLabel } from '../../ui/ControlSection';
import { cn } from '../../ui/infrastructure/standards';
import { Stack } from '../../ui/Layout';

// --- SUB-COMPONENT: Field ---

interface FieldProps {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  error?: string;
  id?: string;
}

/**
 * Связка подписи (Label) и элемента управления.
 * Автоматически генерирует ID для доступности (accessibility).
 */
export function Field({ label, children, className, error, id: customId }: FieldProps) {
  const generatedId = useId();
  const id = customId || generatedId;

  return (
    <Stack gap={1.5} className={className}>
      <label htmlFor={id}>
        <ControlLabel className="cursor-pointer">{label}</ControlLabel>
      </label>
      <div id={id + '-container'}>
        {/* Клонируем дочерний элемент, чтобы пробросить ID, если это нативный инпут */}
        {React.isValidElement(children)
          ? React.cloneElement(children as React.ReactElement<{ id?: string }>, { id })
          : children}
      </div>
      {error && <span className="text-[10px] font-bold text-red-500 uppercase">{error}</span>}
    </Stack>
  );
}

// --- SUB-COMPONENT: TextInput ---

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

/**
 * Стандартизированное текстовое поле ввода.
 */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs shadow-sm transition-all',
          'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
          'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
          'placeholder:text-zinc-400 dark:placeholder:text-zinc-600',
          error && 'border-red-500 ring-red-500/20',
          className
        )}
        {...props}
      />
    );
  }
);

TextInput.displayName = 'TextInput';

// --- SUB-COMPONENT: TextArea ---

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'custom-scrollbar w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs shadow-sm transition-all',
          'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none',
          'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
          'resize-none',
          error && 'border-red-500 ring-red-500/20',
          className
        )}
        {...props}
      />
    );
  }
);

TextArea.displayName = 'TextArea';
