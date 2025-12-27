'use client';

import React, { forwardRef } from 'react';

import { cn } from '@/core/tailwind/utils';

interface SurfaceBaseProps {
  className?: string;
  rendering?: 'auto' | 'pixelated' | 'crisp-edges';
  interaction?: 'all' | 'none';
}

interface CanvasProps extends SurfaceBaseProps, React.CanvasHTMLAttributes<HTMLCanvasElement> {}
interface VideoProps extends SurfaceBaseProps, React.VideoHTMLAttributes<HTMLVideoElement> {}

const getSurfaceClass = (rendering: string, interaction: string, className?: string) =>
  cn(
    'block max-w-full h-auto',
    rendering === 'pixelated' && 'image-rendering-pixelated',
    rendering === 'crisp-edges' && 'image-rendering-crisp-edges',
    interaction === 'none' && 'pointer-events-none select-none',
    className
  );

/**
 * Унифицированный интерфейс для работы с графическими поверхностями.
 */
export const Surface = {
  Canvas: forwardRef<HTMLCanvasElement, CanvasProps>(
    ({ rendering = 'auto', interaction = 'all', className, ...props }, ref) => (
      <canvas ref={ref} className={getSurfaceClass(rendering, interaction, className)} {...props} />
    )
  ),

  Video: forwardRef<HTMLVideoElement, VideoProps>(
    ({ rendering = 'auto', interaction = 'all', className, ...props }, ref) => (
      <video
        ref={ref}
        className={getSurfaceClass(rendering, interaction, className)}
        muted
        playsInline
        crossOrigin="anonymous"
        {...props}
      />
    )
  ),
};

Surface.Canvas.displayName = 'Surface.Canvas';
Surface.Video.displayName = 'Surface.Video';
