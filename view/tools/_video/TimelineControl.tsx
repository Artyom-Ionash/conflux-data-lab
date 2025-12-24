import React, { useEffect, useRef, useState } from 'react';

import { getAspectRatioStyle } from '@/core/tailwind/utils';
import { Card } from '@/view/ui/container/Card';
import { NumberStepper } from '@/view/ui/input/NumberStepper';
import { RangeSlider } from '@/view/ui/input/RangeSlider';
import { Group, Stack } from '@/view/ui/layout/Layout';
import { DualHoverPreview } from '@/view/ui/media/DualHoverPreview';
import { Indicator } from '@/view/ui/primitive/Indicator';
import { Separator } from '@/view/ui/primitive/Separator';
import { Typography } from '@/view/ui/primitive/Typography';

interface TimelineControlProps {
  // Data
  startTime: number;
  endTime: number;
  effectiveEnd: number;
  duration: number | null;
  frameStep: number;
  videoSrc: string | null;
  videoDimensions: { width: number; height: number } | null;

  // Resources
  hoverVideoRef: React.RefObject<HTMLVideoElement>;
  previewStart: string | null;
  previewEnd: string | null;
  error?: string | null;

  // Actions
  onTimeChange: (start: number, end: number) => void;
  onStepChange: (step: number) => void;
}

export function TimelineControl({
  startTime,
  effectiveEnd,
  duration,
  frameStep,
  videoSrc,
  videoDimensions,
  hoverVideoRef,
  previewStart,
  previewEnd,
  error,
  onTimeChange,
  onStepChange,
}: TimelineControlProps) {
  const [hoverPreview, setHoverPreview] = useState<{ activeThumb: 0 | 1; time: number } | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isVideoSeeking, setIsVideoSeeking] = useState(false); // Новое состояние
  const containerRef = useRef<HTMLDivElement>(null);

  // Подписка на события поиска (Seek) видео
  useEffect(() => {
    const video = hoverVideoRef.current;
    if (!video) return;

    const onSeeking = () => setIsVideoSeeking(true);
    const onSeeked = () => setIsVideoSeeking(false);

    video.addEventListener('seeking', onSeeking);
    video.addEventListener('seeked', onSeeked);

    return () => {
      video.removeEventListener('seeking', onSeeking);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [hoverVideoRef]);

  const handleSliderHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const time = percentage * duration;

    const distToStart = Math.abs(time - startTime);
    const distToEnd = Math.abs(time - effectiveEnd);
    const nearestThumb = distToStart < distToEnd ? 0 : 1;

    setHoverPreview({ activeThumb: nearestThumb, time });
    if (hoverVideoRef.current) hoverVideoRef.current.currentTime = time;
  };

  const handleValueChange = (newValues: number[], thumbIndex?: 0 | 1) => {
    const start = newValues[0] ?? 0;
    const end = newValues[1] ?? 0;
    onTimeChange(start, end);

    if (isDragging && typeof thumbIndex === 'number') {
      const changedTime = newValues[thumbIndex] ?? 0;
      setHoverPreview({ activeThumb: thumbIndex, time: changedTime });
      if (hoverVideoRef.current) hoverVideoRef.current.currentTime = changedTime;
    }
  };

  return (
    <Card className="relative z-20 overflow-visible shadow-sm" contentClassName="p-4">
      <Stack gap={4}>
        <Group justify="between" wrap>
          <Group gap={6}>
            <Typography.Text variant="label">Диапазон</Typography.Text>
            <Separator />
            <NumberStepper
              label="Шаг (сек)"
              value={frameStep}
              onChange={onStepChange}
              step={0.05}
              min={0.05}
              max={10}
            />
          </Group>
          <Indicator label="Range">
            {startTime.toFixed(2)}s<span className="mx-1 opacity-50">→</span>
            {effectiveEnd.toFixed(2)}s
          </Indicator>
        </Group>

        <Stack
          ref={containerRef}
          gap={0}
          className="group relative touch-none py-2"
          onMouseMove={handleSliderHover}
          onMouseLeave={() => !isDragging && setHoverPreview(null)}
          onPointerDown={() => setIsDragging(true)}
          onPointerUp={() => {
            setIsDragging(false);
            setHoverPreview(null);
          }}
        >
          <RangeSlider
            min={0}
            max={duration ?? 0}
            step={0.01}
            value={[startTime, effectiveEnd]}
            onValueChange={handleValueChange}
            minStepsBetweenThumbs={0.1}
          />
          {hoverPreview && (
            <DualHoverPreview
              activeThumb={hoverPreview.activeThumb}
              hoverTime={hoverPreview.time}
              startTime={startTime}
              endTime={effectiveEnd}
              videoSrc={videoSrc}
              videoRef={hoverVideoRef}
              previewStartImage={previewStart}
              previewEndImage={previewEnd}
              isLoading={isVideoSeeking}
              aspectRatioStyle={getAspectRatioStyle(
                videoDimensions?.width,
                videoDimensions?.height
              )}
            />
          )}
        </Stack>
        {error && (
          <Typography.Text variant="error" align="right">
            {error}
          </Typography.Text>
        )}
      </Stack>
    </Card>
  );
}
