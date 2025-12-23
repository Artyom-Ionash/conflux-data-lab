'use client';

import Image from 'next/image';
import React, { useMemo } from 'react';

import { getAspectRatioStyle } from '@/view/ui/_infrastructure/standards';
import { Checkerboard } from '@/view/ui/canvas/Checkerboard';
import { Indicator } from '@/view/ui/primitive/Indicator';
import { OverlayLabel } from '@/view/ui/primitive/OverlayLabel';
import { Typography } from '@/view/ui/primitive/Typography';

interface FrameData {
  time: number;
  dataUrl: string | null;
}

interface SpriteFrameListProps {
  frames: FrameData[];
  maxHeight: number;
  spacing: number;
  backgroundColor: string;
  videoAspectRatio: number;
}

/**
 * Композитный компонент для отображения последовательности извлечённых кадров.
 * Использует Checkerboard для прозрачных фонов и унифицированную типографику.
 */
export function SpriteFrameList({
  frames,
  maxHeight,
  spacing,
  backgroundColor,
  videoAspectRatio,
}: SpriteFrameListProps) {
  const frameStyle = useMemo(
    () => ({
      ...getAspectRatioStyle(videoAspectRatio),
      height: maxHeight,
    }),
    [videoAspectRatio, maxHeight]
  );

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
      className="flex items-start border border-dashed border-zinc-300 dark:border-zinc-700"
      style={{
        gap: spacing,
        backgroundColor: isTransparent ? undefined : backgroundColor,
      }}
    >
      {frames.map((frame, idx) => (
        <div key={idx} className="group relative shrink-0 overflow-hidden" style={frameStyle}>
          {isTransparent && <Checkerboard size={8} className="absolute inset-0" />}

          {frame.dataUrl ? (
            <Image
              src={frame.dataUrl}
              alt={`frame-${idx}`}
              width={calculatedWidth}
              height={maxHeight}
              unoptimized
              className="relative z-10 h-full w-full object-contain shadow-sm"
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-zinc-200 dark:bg-zinc-800" />
          )}

          {/* Метка времени: теперь через Indicator */}
          <div className="absolute bottom-2 left-2 z-20">
            <Indicator>{frame.time.toFixed(2)}s</Indicator>
          </div>

          {/* Индекс кадра: вынесенный системныйOverlayLabel */}
          <OverlayLabel position="top-right" className="opacity-0 group-hover:opacity-100">
            #{idx + 1}
          </OverlayLabel>
        </div>
      ))}
    </div>
  );
}
