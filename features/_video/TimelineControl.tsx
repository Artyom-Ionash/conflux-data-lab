import React, { useRef } from 'react';

import { useVideoScrubber } from '@/core/react/hooks/use-video-scrubber';
import { Card } from '@/ui/container/Card';
import { NumberStepper } from '@/ui/input/NumberStepper';
import { RangeSlider } from '@/ui/input/RangeSlider';
import { Group, Stack } from '@/ui/layout/Layout';
import { DualHoverPreview } from '@/ui/media/DualHoverPreview';
import { Indicator } from '@/ui/primitive/Indicator';
import { Separator } from '@/ui/primitive/Separator';
import { Typography } from '@/ui/primitive/Typography';

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
  const containerRef = useRef<HTMLDivElement>(null);

  // Вся сложная логика ушла сюда
  const { hoverPreview, isSeeking, handlers } = useVideoScrubber({
    videoRef: hoverVideoRef,
    duration,
    startTime,
    endTime: effectiveEnd,
  });

  const handleValueChange = (newValues: number[], thumbIndex?: 0 | 1) => {
    const start = newValues[0] ?? 0;
    const end = newValues[1] ?? 0;
    onTimeChange(start, end);

    // Синхронизируем превью при перетаскивании
    if (typeof thumbIndex === 'number') {
      const changedTime = newValues[thumbIndex] ?? 0;
      handlers.updatePreviewOnDrag(changedTime, thumbIndex);
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
          onMouseMove={handlers.onMouseMove}
          onMouseLeave={handlers.onMouseLeave}
          onPointerDown={handlers.onPointerDown}
          onPointerUp={handlers.onPointerUp}
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
              isLoading={isSeeking}
              videoDimensions={videoDimensions}
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
