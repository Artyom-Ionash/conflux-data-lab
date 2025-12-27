import React, { useCallback, useMemo } from 'react';

import { downloadDataUrl } from '@/core/browser/canvas';
import { getAspectRatio } from '@/core/primitives/math';
import type { ExtractedFrame } from '@/lib/video/extraction';
import { NumberStepper } from '@/ui/atoms/input/NumberStepper';
import { Box } from '@/ui/atoms/layout/Box';
import { Grid, Group, Stack } from '@/ui/atoms/layout/Layout';
import { ImageSequencePlayer } from '@/ui/atoms/media/ImageSequencePlayer';
import { OverlayLabel } from '@/ui/atoms/primitive/OverlayLabel';
import { Typography } from '@/ui/atoms/primitive/Typography';
import { Button } from '@/ui/molecules/input/Button';
import { MediaCard } from '@/ui/molecules/media/MediaCard';
import { RangeVideoPlayer } from '@/ui/molecules/media/RangeVideoPlayer';

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

  const currentSpeedPercent = Math.round((gifFps / captureFps) * 100);

  // Стабилизируем массив URL, чтобы плеер не перезагружался на каждом тике таймера
  const imageUrls = useMemo(() => frames.map((f) => f.dataUrl), [frames]);

  const handleDrawOverlay = useCallback(
    (ctx: CanvasRenderingContext2D, index: number, w: number, h: number) => {
      const frame = frames[index];
      if (!frame) return;

      const timeText = `${frame.time.toFixed(2)}s`;
      const fontSize = Math.max(14, Math.floor(w * 0.05));

      ctx.save(); // Сохраняем состояние контекста
      ctx.font = `bold ${fontSize}px monospace`;

      const margin = Math.max(8, w * 0.03);
      const x = margin;
      const y = h - margin;

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(timeText, x, y);

      ctx.fillStyle = 'white';
      ctx.fillText(timeText, x, y);
      ctx.restore(); // Восстанавливаем состояние
    },
    [frames]
  );

  return (
    <Grid className="grid-cols-1 lg:grid-cols-3" gap={4}>
      {/* 1. Исходное видео */}
      <MediaCard title="Исходное видео" ratio={videoRatio}>
        <RangeVideoPlayer
          src={videoSrc}
          startTime={startTime}
          endTime={endTime}
          className="absolute inset-0"
        />
      </MediaCard>

      {/* 2. Разница */}
      <MediaCard
        title="Разница"
        ratio={videoRatio}
        actions={
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
      >
        <Box className="relative h-full w-full bg-zinc-100 dark:bg-zinc-950">
          <FrameDiffOverlay
            image1={previewStart}
            image2={previewEnd}
            isProcessing={isDiffProcessing}
            onDataGenerated={onDiffGenerated}
          />
        </Box>
      </MediaCard>

      {/* 3. Спрайт / GIF */}
      <MediaCard
        title="Спрайт"
        ratio={videoRatio}
        actions={
          <Group gap={4}>
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
            {frames.length > 0 && !isProcessing && (
              <Button onClick={onDownloadGif} variant="link" size="xs" disabled={isProcessing}>
                Скачать GIF
              </Button>
            )}
          </Group>
        }
      >
        <Box className="relative h-full w-full bg-zinc-100 dark:bg-zinc-950">
          <Stack
            className="group relative h-full w-full cursor-pointer"
            gap={0}
            onClick={onOpenScaleModal}
          >
            {frames.length > 0 || isProcessing ? (
              <>
                <ImageSequencePlayer
                  images={imageUrls}
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
        </Box>
      </MediaCard>
    </Grid>
  );
}
