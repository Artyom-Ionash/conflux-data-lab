import Image from 'next/image';
import type { RefObject } from 'react';
import React from 'react';

import { getAspectRatio } from '@/core/primitives/math';
import { Loader } from '@/view/ui/feedback/Loader';
import { AspectRatio } from '@/view/ui/layout/AspectRatio'; // Используем компонент
import { Box } from '@/view/ui/layout/Box';
import { Grid, Stack } from '@/view/ui/layout/Layout';
import { Overlay } from '@/view/ui/layout/Overlay';
import { Badge } from '@/view/ui/primitive/Badge';

interface DualHoverPreviewProps {
  activeThumb: 0 | 1;
  hoverTime: number;
  startTime: number;
  endTime: number;
  videoSrc: string | null;
  videoRef: RefObject<HTMLVideoElement>;
  previewStartImage: string | null;
  previewEndImage: string | null;
  videoDimensions?: { width: number; height: number } | null;
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
  videoDimensions,
  isLoading = false,
}: DualHoverPreviewProps) {
  // Используем математический примитив для получения числа, а не стиля
  const ratio = getAspectRatio(videoDimensions?.width, videoDimensions?.height);

  const renderFrame = (
    isActive: boolean,
    imageSrc: string | null,
    displayTime: number,
    label: string,
    badgeVariant: 'info' | 'accent'
  ) => (
    <Stack
      gap={2}
      items="center"
      className={`transition-opacity duration-200 ${
        isActive ? 'opacity-100' : 'opacity-50 grayscale-[0.5]'
      }`}
    >
      <AspectRatio
        ratio={ratio}
        className={`rounded-lg border-4 bg-black shadow-lg transition-all ${
          isActive
            ? badgeVariant === 'info'
              ? 'border-blue-500 shadow-blue-500/20'
              : 'border-purple-500 shadow-purple-500/20'
            : 'border-zinc-800'
        }`}
      >
        {imageSrc && (
          <Image
            src={imageSrc}
            alt={label.toLowerCase()}
            fill
            unoptimized
            className="object-contain"
          />
        )}
        {isActive && videoSrc && (
          <Box className="fx-cover bg-black">
            <video
              ref={videoRef}
              src={videoSrc}
              className="h-full w-full object-contain"
              muted
              playsInline
            />
            <Overlay center dim visible={isLoading}>
              <Loader size="md" className="text-white" />
            </Overlay>
          </Box>
        )}
      </AspectRatio>
      <Badge variant={isActive ? badgeVariant : 'outline'}>
        {label}: {displayTime.toFixed(2)}s
      </Badge>
    </Stack>
  );

  return (
    <Box className="z-tooltip pointer-events-none absolute top-full left-1/2 mt-6 w-[98vw] max-w-[1600px] -translate-x-1/2">
      <Grid
        cols={2}
        gap={6}
        className="rounded-2xl border border-white/10 bg-zinc-950/95 p-6 shadow-2xl backdrop-blur-md"
      >
        {renderFrame(
          activeThumb === 0,
          previewStartImage,
          activeThumb === 0 ? hoverTime : startTime,
          'START',
          'info'
        )}
        {renderFrame(
          activeThumb === 1,
          previewEndImage,
          activeThumb === 1 ? hoverTime : endTime,
          'END',
          'accent'
        )}
      </Grid>
    </Box>
  );
}
