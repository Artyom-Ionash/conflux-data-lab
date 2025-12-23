'use client';

import React, { forwardRef } from 'react';

import { cn } from '../../../core/tailwind/utils';

// Базовые стили вынесены, чтобы TextInput и TextArea выглядели одинаково
const inputStyles = cn(
  'w-full rounded-md border border-zinc-200 bg-white px-3 py-2 font-mono text-xs shadow-sm transition-all',
  'placeholder:text-zinc-400 dark:placeholder:text-zinc-600',
  'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100',
  'focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20',
  'disabled:cursor-not-allowed disabled:opacity-50'
);

const errorStyles = 'border-red-500 focus:border-red-500 focus:ring-red-500/20';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const TextInput = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input ref={ref} className={cn(inputStyles, error && errorStyles, className)} {...props} />
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
        className={cn(inputStyles, 'custom-scrollbar resize-none', error && errorStyles, className)}
        {...props}
      />
    );
  }
);
TextArea.displayName = 'TextArea';
