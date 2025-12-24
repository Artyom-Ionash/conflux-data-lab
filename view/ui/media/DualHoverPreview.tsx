import Image from 'next/image';
import type { RefObject } from 'react';
import React from 'react';

interface DualHoverPreviewProps {
  activeThumb: 0 | 1;
  hoverTime: number;
  startTime: number;
  endTime: number;
  videoSrc: string | null;
  videoRef: RefObject<HTMLVideoElement>;
  previewStartImage: string | null;
  previewEndImage: string | null;
  aspectRatioStyle: React.CSSProperties;
  isLoading?: boolean;
}

export function DualHoverPreview({
  activeThumb,
  hoverTime,
  startTime,
  endTime,
  videoSrc,
  videoRef,
  previewStartImage,
  previewEndImage,
  aspectRatioStyle,
  isLoading = false,
}: DualHoverPreviewProps) {
  const renderFrame = (
    isActive: boolean,
    imageSrc: string | null,
    displayTime: number,
    label: string,
    colorClass: string,
    borderColorClass: string
  ) => (
    <div
      className={`relative flex flex-col items-center gap-2 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-50 grayscale-[0.5]'}`}
    >
      <div
        className={`relative w-full overflow-hidden rounded-lg border-4 bg-black shadow-lg transition-all ${isActive ? borderColorClass : 'border-zinc-800'}`}
        style={aspectRatioStyle}
      >
        {imageSrc && (
          <Image
            src={imageSrc}
            alt={label.toLowerCase()}
            fill
            unoptimized // Важно для Data URL
            className="object-contain"
          />
        )}
        {isActive && videoSrc && (
          <div className="absolute inset-0 bg-black">
            <video
              ref={videoRef}
              src={videoSrc}
              className="h-full w-full object-contain"
              muted
              playsInline
            />
            {/* Loading Indicator */}
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              </div>
            )}
          </div>
        )}
      </div>
      <span
        className={`rounded-full px-3 py-1 font-mono text-xs font-bold shadow-sm ${isActive ? colorClass : 'bg-zinc-800 text-zinc-500'}`}
      >
        {label}: {displayTime.toFixed(2)}s
      </span>
    </div>
  );

  return (
    <div className="z-tooltip pointer-events-none absolute top-full left-1/2 mt-6 w-[98vw] max-w-[1600px] -translate-x-1/2">
      <div className="grid grid-cols-2 gap-6 rounded-2xl border border-white/10 bg-zinc-950/95 p-6 shadow-2xl backdrop-blur-md">
        {renderFrame(
          activeThumb === 0,
          previewStartImage,
          activeThumb === 0 ? hoverTime : startTime,
          'START',
          'bg-blue-600 text-white',
          'border-blue-500 shadow-blue-500/20'
        )}
        {renderFrame(
          activeThumb === 1,
          previewEndImage,
          activeThumb === 1 ? hoverTime : endTime,
          'END',
          'bg-purple-600 text-white',
          'border-purple-500 shadow-purple-500/20'
        )}
      </div>
    </div>
  );
}
