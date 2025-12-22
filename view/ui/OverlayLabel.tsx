import React from 'react';

import { cn } from '@/view/ui/infrastructure/standards';

interface OverlayLabelProps {
  children: React.ReactNode;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}

/**
 * Техническая метка, накладываемая поверх визуального контента (кадров, слоёв).
 */
interface OverlayLabelProps {
  children: React.ReactNode;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}

/**
 * Техническая метка, накладываемая поверх визуального контента (кадров, слоёв).
 */
export function OverlayLabel({
  children,
  position = 'top-left',
  className = '',
}: OverlayLabelProps) {
  const positions = {
    'top-left': 'top-1 left-1',
    'top-right': 'top-1 right-1',
    'bottom-left': 'bottom-1 left-1',
    'bottom-right': 'bottom-1 right-1',
  };

  return (
    <div
      className={cn(
        'pointer-events-none absolute z-20 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white backdrop-blur-sm transition-opacity duration-200 select-none',
        positions[position],
        className
      )}
    >
      {children}
    </div>
  );
}
