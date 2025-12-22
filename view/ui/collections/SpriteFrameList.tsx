import Image from 'next/image';
import React, { useMemo } from 'react';

import { cn, getAspectRatioStyle } from '@/view/ui/infrastructure/standards';

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

const TIMESTAMP_CLASS =
  'absolute bottom-2 left-2 pointer-events-none bg-black/80 text-white px-2 py-0.5 rounded text-[11px] font-bold font-mono shadow-sm backdrop-blur-[1px]';
const TRANSPARENT_BG_PATTERN =
  "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAKQCAYAAAB2440yAAAAIklEQVQ4jWNgGAWjYBQMBAAABgAB/6Zj+QAAAABJRU5ErkJggg==')";

export function SpriteFrameList({
  frames,
  maxHeight,
  spacing,
  backgroundColor,
  videoAspectRatio,
}: SpriteFrameListProps) {
  // [LEMON] Используем стандартный стиль для контейнера кадра
  const frameStyle = useMemo(() => {
    return {
      ...getAspectRatioStyle(videoAspectRatio),
      height: maxHeight,
    };
  }, [videoAspectRatio, maxHeight]);

  // Расчёт ширины нужен для атрибута width компонента Image (Next.js требует числа)
  const calculatedWidth = useMemo(
    () => Math.floor(maxHeight * videoAspectRatio),
    [maxHeight, videoAspectRatio]
  );

  if (frames.length === 0) {
    return <div className="py-8 text-center text-zinc-400">Нет кадров</div>;
  }

  const isTransparent = backgroundColor === 'transparent';

  return (
    <div
      className={`flex items-start border border-dashed border-zinc-300 dark:border-zinc-700 ${isTransparent ? 'bg-repeat' : ''}`}
      style={{
        backgroundColor: isTransparent ? undefined : backgroundColor,
        backgroundImage: isTransparent ? TRANSPARENT_BG_PATTERN : undefined,
        gap: spacing,
      }}
    >
      {frames.map((frame, idx) => (
        <div key={idx} className="group relative shrink-0 overflow-hidden" style={frameStyle}>
          {frame.dataUrl ? (
            <Image
              src={frame.dataUrl}
              alt={`frame-${idx}`}
              width={calculatedWidth}
              height={maxHeight}
              unoptimized
              className="h-full w-full object-contain shadow-sm"
            />
          ) : (
            <div className="h-full w-full animate-pulse bg-black/5" />
          )}

          <div className={TIMESTAMP_CLASS}>{frame.time.toFixed(2)}s</div>

          <OverlayLabel position="top-right" className="opacity-0 group-hover:opacity-100">
            #{idx + 1}
          </OverlayLabel>
        </div>
      ))}
    </div>
  );
}
