// view/ui/collections/SpriteFrameList.tsx

import Image from 'next/image';
import React, { useMemo } from 'react';

import { Checkerboard } from '@/view/ui/Checkerboard';
import { InfoBadge } from '@/view/ui/InfoBadge';
import { getAspectRatioStyle } from '@/view/ui/infrastructure/standards';
import { OverlayLabel } from '@/view/ui/OverlayLabel';

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

  if (frames.length === 0) {
    return <div className="py-8 text-center text-xs text-zinc-400">Нет кадров</div>;
  }

  const isTransparent = backgroundColor === 'transparent';

  return (
    <div
      className="flex items-start border border-dashed border-zinc-300 dark:border-zinc-700"
      style={{ gap: spacing, backgroundColor: isTransparent ? undefined : backgroundColor }}
    >
      {frames.map((frame, idx) => (
        <div key={idx} className="group relative shrink-0 overflow-hidden" style={frameStyle}>
          {isTransparent && <Checkerboard size={8} className="absolute inset-0" />}

          {frame.dataUrl ? (
            <Image
              src={frame.dataUrl}
              alt={`frame-${idx}`}
              width={Math.floor(maxHeight * videoAspectRatio)}
              height={maxHeight}
              unoptimized
              className="relative z-10 h-full w-full object-contain"
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-zinc-200 dark:bg-zinc-800" />
          )}

          <div className="absolute bottom-2 left-2 z-20">
            <InfoBadge>{frame.time.toFixed(2)}s</InfoBadge>
          </div>

          <OverlayLabel position="top-right" className="opacity-0 group-hover:opacity-100">
            #{idx + 1}
          </OverlayLabel>
        </div>
      ))}
    </div>
  );
}
