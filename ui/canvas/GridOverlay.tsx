'use client';

import React from 'react';

import { cn } from '@/core/tailwind/utils';

interface GridOverlayProps {
  color?: string;
  stepX: number;
  stepY: number;
  offsetX?: number;
  offsetY?: number;
  dash?: number;
  opacity?: number;
  className?: string;
}

/**
 * Накладываемая сетка для Canvas.
 * Поддерживает смещение и пунктир.
 */
export function GridOverlay({
  color = '#00ff00',
  stepX,
  stepY,
  offsetX = 0,
  offsetY = 0,
  dash,
  opacity = 0.5,
  className,
}: GridOverlayProps) {
  const gradientStyle = dash
    ? `linear-gradient(to right, ${color} ${dash}px, transparent ${dash}px), linear-gradient(to bottom, ${color} ${dash}px, transparent ${dash}px)`
    : `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`;

  // CSS offset format: "x y"
  const backgroundPosition = dash ? '-5px -5px' : `${offsetX}px ${offsetY}px`;

  return (
    <div
      className={cn('fx-cover pointer-events-none', className)}
      style={{
        zIndex: 'var(--z-canvas-overlay)',
        opacity,
        backgroundImage: gradientStyle,
        backgroundSize: `${stepX}px ${stepY}px`,
        backgroundPosition,
      }}
    />
  );
}
