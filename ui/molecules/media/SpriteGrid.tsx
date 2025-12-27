'use client';

import Image from 'next/image';
import React, { useMemo } from 'react';

import { Checkerboard } from '@/ui/atoms/canvas/Checkerboard';
import { AspectRatio } from '@/ui/atoms/layout/AspectRatio';
import { Indicator } from '@/ui/atoms/primitive/Indicator';
import { OverlayLabel } from '@/ui/atoms/primitive/OverlayLabel';
import { Typography } from '@/ui/atoms/primitive/Typography';

interface FrameData {
  time: number;
  dataUrl: string | null;
}

interface SpriteGridProps {
  frames: FrameData[];
  maxHeight: number;
  spacing: number;
  backgroundColor: string;
  videoAspectRatio: number;
}

export function SpriteGrid({
  frames,
  maxHeight,
  spacing,
  backgroundColor,
  videoAspectRatio,
}: SpriteGridProps) {
  // Вычисляем только ширину контейнера, высота определится ratio внутри AspectRatio
  const calculatedWidth = useMemo(
    () => Math.floor(maxHeight * videoAspectRatio),
    [maxHeight, videoAspectRatio]
  );

  if (frames.length === 0) {
    return (
      <div className="py-8 text-center">
        <Typography.Text variant="dimmed">Нет кадров</Typography.Text>
      </div>
    );
  }

  const isTransparent = backgroundColor === 'transparent';

  return (
    <div
      // Теперь `z-below` (дочерний элемент) не провалится под родительскую карточку.
      className="relative z-(--z-base) inline-flex w-max items-start overflow-hidden rounded-md border border-dashed border-zinc-300 dark:border-zinc-700"
      style={{ gap: spacing }}
    >
      {/* 1. Слой фона */}
      <div className="absolute inset-0 z-(--z-below)">
        {isTransparent ? (
          <Checkerboard className="h-full w-full" size={16} />
        ) : (
          <div className="h-full w-full transition-colors" style={{ backgroundColor }} />
        )}
      </div>

      {/* 2. Слой контента */}
      {frames.map((frame, idx) => (
        <div
          key={idx}
          className="group relative z-(--z-content) shrink-0 overflow-hidden shadow-sm transition-shadow hover:shadow-md"
          style={{ width: calculatedWidth }}
        >
          <AspectRatio ratio={videoAspectRatio}>
            {frame.dataUrl ? (
              <Image
                src={frame.dataUrl}
                alt={`frame-${idx}`}
                fill
                unoptimized
                className="object-contain"
              />
            ) : (
              <div className="h-full w-full animate-pulse bg-zinc-200 dark:bg-zinc-800" />
            )}
          </AspectRatio>

          {/* 3. Слой интерфейса */}
          <div className="absolute bottom-2 left-2 z-(--z-decorator) opacity-0 transition-opacity group-hover:opacity-100">
            <Indicator>{frame.time.toFixed(2)}s</Indicator>
          </div>

          <OverlayLabel
            position="top-right"
            className="z-(--z-decorator) opacity-0 group-hover:opacity-100"
          >
            #{idx + 1}
          </OverlayLabel>
        </div>
      ))}
    </div>
  );
}
