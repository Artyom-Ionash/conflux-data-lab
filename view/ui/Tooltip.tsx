'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import React from 'react';

import { cn } from './infrastructure/standards';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function Tooltip({ children, content, className, side = 'top' }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={5}
            className={cn(
              'animate-in fade-in zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 z-[500] max-w-xs',
              'rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 shadow-xl backdrop-blur-sm',
              'text-[11px] leading-relaxed text-zinc-100',
              className
            )}
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-zinc-700" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
