import Image from 'next/image';
import React, { useEffect, useMemo, useState } from 'react';

import { Checkerboard } from '@/view/ui/canvas/Checkerboard';

interface MultiScalePreviewProps {
  frames: (string | null)[];
  fps: number;
}

const PREVIEW_SCALES = [32, 64, 128, 256, 512];
const PIXELATED_THRESHOLD = 64;

export function MultiScalePreview({ frames, fps }: MultiScalePreviewProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const validFrames = useMemo(() => frames.filter((f): f is string => f !== null), [frames]);

  useEffect(() => {
    if (validFrames.length === 0) return;
    let frameId: number;
    let lastTime = performance.now();
    const interval = 1000 / fps;

    const loop = (time: number) => {
      const delta = time - lastTime;
      if (delta >= interval) {
        setCurrentIndex((prev) => (prev + 1) % validFrames.length);
        lastTime = time - (delta % interval);
      }
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [validFrames.length, fps]);

  if (validFrames.length === 0) {
    return <div className="text-zinc-500">Нет кадров для отображения</div>;
  }

  const currentSrc = validFrames[currentIndex];

  return (
    <div className="flex flex-wrap content-center items-center justify-center gap-x-12 gap-y-12">
      {PREVIEW_SCALES.map((size) => (
        <div key={size} className="flex flex-col items-center gap-4">
          <Checkerboard
            className="flex items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-black/50 shadow-[0_0_30px_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.02]"
            size={20}
          >
            <div style={{ width: size, height: size }}>
              <Image
                src={currentSrc ?? ''}
                alt={`${size}px preview`}
                width={size}
                height={size}
                unoptimized // Важно для Data URL
                className="h-full w-full object-contain"
                style={{ imageRendering: size < PIXELATED_THRESHOLD ? 'pixelated' : 'auto' }}
              />
            </div>
          </Checkerboard>
          <span className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 font-mono text-sm font-bold text-zinc-400">
            {size}x{size}
          </span>
        </div>
      ))}
    </div>
  );
}
