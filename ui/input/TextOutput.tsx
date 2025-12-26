'use client';

import React, { forwardRef } from 'react';

import { cn } from '@/core/tailwind/utils';

export interface TextOutputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: 'default' | 'mono';
}

export const TextOutput = forwardRef<HTMLTextAreaElement, TextOutputProps>(
  ({ className, variant = 'mono', readOnly = true, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        readOnly={readOnly}
        className={cn(
          'fx-scrollbar w-full resize-none border-none bg-transparent p-4 outline-none focus:ring-0',
          variant === 'mono' && 'font-mono text-[11px] leading-relaxed',
          className
        )}
        {...props}
      />
    );
  }
);

TextOutput.displayName = 'TextOutput';
