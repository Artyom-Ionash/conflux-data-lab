import React, { useCallback, useMemo } from 'react';

import { downloadDataUrl } from '@/core/browser/canvas';
import { getAspectRatio } from '@/core/primitives/math';
import { getAspectRatioStyle } from '@/core/tailwind/utils';
import type { ExtractedFrame } from '@/lib/video/extraction';
import { Card } from '@/view/ui/container/Card';
import { Button } from '@/view/ui/input/Button';
import { NumberStepper } from '@/view/ui/input/NumberStepper';
import { Columns, Group, Stack } from '@/view/ui/layout/Layout';
import { ImageSequencePlayer } from '@/view/ui/media/ImageSequencePlayer';
import { RangeVideoPlayer } from '@/view/ui/media/RangeVideoPlayer';
import { OverlayLabel } from '@/view/ui/primitive/OverlayLabel';
import { Typography } from '@/view/ui/primitive/Typography';

import { FrameDiffOverlay } from './FrameDiffOverlay';

interface MonitorDashboardProps {
  videoSrc: string | null;
  startTime: number;
  endTime: number;
  videoDimensions: { width: number; height: number } | null;

  previewStart: string | null;
  previewEnd: string | null;
  diffDataUrl: string | null;
  isDiffProcessing: boolean;

  frames: ExtractedFrame[];
  gifFps: number;
  captureFps: number;
  isProcessing: boolean;

  // Callbacks
  onDiffGenerated: (url: string | null) => void;
  onGifFpsChange: (fps: number) => void;
  onDownloadGif: () => void;
  onOpenScaleModal: () => void;
}

export function MonitorDashboard({
  videoSrc,
  startTime,
  endTime,
  videoDimensions,
  previewStart,
  previewEnd,
  diffDataUrl,
  isDiffProcessing,
  frames,
  gifFps,
  captureFps,
  isProcessing,
  onDiffGenerated,
  onGifFpsChange,
  onDownloadGif,
  onOpenScaleModal,
}: MonitorDashboardProps) {
  const videoRatio = useMemo(
    () => getAspectRatio(videoDimensions?.width, videoDimensions?.height) || 1.77,
    [videoDimensions]
  );

  const aspectRatioStyle = getAspectRatioStyle(videoRatio);
  const currentSpeedPercent = Math.round((gifFps / captureFps) * 100);

  const handleDrawOverlay = useCallback(
    (ctx: CanvasRenderingContext2D, index: number, w: number, h: number) => {
      const frame = frames[index];
      if (!frame) return;
      const timeText = `${frame.time.toFixed(2)}s`;
      const fontSize = Math.max(14, Math.floor(w * 0.05));
      ctx.font = `bold ${fontSize}px monospace`;

      const margin = Math.max(8, w * 0.03);
      const x = margin;
      const y = h - margin;

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(timeText, x, y);

      ctx.fillStyle = 'white';
      ctx.fillText(timeText, x, y);
    },
    [frames]
  );

  return (
    <Columns desktop={3} gap={4}>
      {/* 1. SOURCE VIDEO */}
      <Card
        className="flex flex-col overflow-hidden shadow-sm"
        title={<Typography.Text variant="label">Исходное видео</Typography.Text>}
        contentClassName="p-0"
      >
        <Stack className="relative w-full bg-black" style={aspectRatioStyle}>
          <RangeVideoPlayer
            src={videoSrc}
            startTime={startTime}
            endTime={endTime}
            className="absolute inset-0"
          />
        </Stack>
      </Card>

      {/* 2. DIFFERENCE */}
      <Card
        className="flex flex-col overflow-hidden shadow-sm"
        title={<Typography.Text variant="label">Разница</Typography.Text>}
        headerActions={
          diffDataUrl ? (
            <Button
              onClick={() => downloadDataUrl(diffDataUrl ?? '', 'diff.png')}
              variant="link"
              size="xs"
            >
              Скачать
            </Button>
          ) : undefined
        }
        contentClassName="p-0"
      >
        <Stack className="relative w-full bg-zinc-100 dark:bg-zinc-950" style={aspectRatioStyle}>
          <FrameDiffOverlay
            image1={previewStart}
            image2={previewEnd}
            isProcessing={isDiffProcessing}
            onDataGenerated={onDiffGenerated}
          />
        </Stack>
      </Card>

      {/* 3. SPRITE PREVIEW */}
      <Card
        className="flex flex-col overflow-hidden shadow-sm"
        title={
          <Group gap={4}>
            <Typography.Text variant="label">Спрайт</Typography.Text>
            <NumberStepper
              label="Скорость %"
              value={currentSpeedPercent}
              onChange={(val) => {
                const newFps = Math.max(1, Math.round(captureFps * (val / 100)));
                onGifFpsChange(newFps);
              }}
              min={10}
              max={500}
              step={10}
            />
            <NumberStepper label="FPS" value={gifFps} onChange={() => {}} disabled />
          </Group>
        }
        headerActions={
          frames.length > 0 && !isProcessing ? (
            <Button onClick={onDownloadGif} variant="link" size="xs" disabled={isProcessing}>
              Скачать GIF
            </Button>
          ) : undefined
        }
        contentClassName="p-0"
      >
        <Stack
          className="group relative w-full cursor-pointer bg-zinc-100 dark:bg-zinc-950"
          style={aspectRatioStyle}
          onClick={onOpenScaleModal}
        >
          {frames.length > 0 || isProcessing ? (
            <>
              <ImageSequencePlayer
                images={frames.map((f) => f.dataUrl)}
                fps={gifFps}
                width={videoDimensions?.width || 300}
                height={videoDimensions?.height || 200}
                onDrawOverlay={handleDrawOverlay}
              />
              <OverlayLabel position="bottom-right" className="opacity-0 group-hover:opacity-100">
                Масштабы ⤢
              </OverlayLabel>
            </>
          ) : (
            <Typography.Text variant="dimmed" align="center" className="py-20">
              Нет кадров
            </Typography.Text>
          )}
        </Stack>
      </Card>
    </Columns>
  );
}
