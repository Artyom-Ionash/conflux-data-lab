'use client';

import * as AspectRatioPrimitive from '@radix-ui/react-aspect-ratio';
import React from 'react';

import { cn } from '@/core/tailwind/utils';

interface AspectRatioProps {
  ratio?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Контейнер, сохраняющий пропорции контента.
 * Заменяет ручное использование getAspectRatioStyle внутри инструментов.
 */
export function AspectRatio({ ratio = 1, children, className, style }: AspectRatioProps) {
  return (
    <AspectRatioPrimitive.Root
      ratio={ratio}
      className={cn('relative w-full overflow-hidden', className)}
      style={style}
    >
      {children}
    </AspectRatioPrimitive.Root>
  );
}
