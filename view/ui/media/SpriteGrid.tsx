'use client';

import Image from 'next/image';
import React, { useMemo } from 'react';

import { Checkerboard } from '@/view/ui/canvas/Checkerboard';
import { AspectRatio } from '@/view/ui/layout/AspectRatio';
import { Indicator } from '@/view/ui/primitive/Indicator';
import { OverlayLabel } from '@/view/ui/primitive/OverlayLabel';
import { Typography } from '@/view/ui/primitive/Typography';

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
      // FIX: Добавлен класс w-max, чтобы контейнер растягивался по содержимому
      // и триггерил скролл у родителя, а не обрезал контент из-за overflow-hidden.
      className="relative inline-flex w-max items-start overflow-hidden rounded-md border border-dashed border-zinc-300 dark:border-zinc-700"
      style={{ gap: spacing }}
    >
      {/* 1. Слой фона */}
      <div className="z-below absolute inset-0">
        {isTransparent ? (
          <Checkerboard
            className="h-full w-full"
            size={16}
            baseColor="bg-white dark:bg-zinc-900"
            color1="#e4e4e7"
            color2="transparent"
          />
        ) : (
          <div className="h-full w-full transition-colors" style={{ backgroundColor }} />
        )}
      </div>

      {/* 2. Слой контента */}
      {frames.map((frame, idx) => (
        <div
          key={idx}
          className="group z-content relative shrink-0 overflow-hidden shadow-sm transition-shadow hover:shadow-md"
          style={{ width: calculatedWidth }} // Задаем ширину, AspectRatio подстроится
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

          <div className="z-interaction absolute bottom-2 left-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Indicator>{frame.time.toFixed(2)}s</Indicator>
          </div>

          <OverlayLabel
            position="top-right"
            className="z-interaction opacity-0 group-hover:opacity-100"
          >
            #{idx + 1}
          </OverlayLabel>
        </div>
      ))}
    </div>
  );
}
