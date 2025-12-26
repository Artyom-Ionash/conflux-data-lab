import Image from 'next/image';
import { useEffect, useRef } from 'react';

import { captureToCanvas, getTopLeftPixelColor, loadImage } from '@/core/browser/canvas';
import { areColorsSimilar } from '@/core/primitives/colors';
import { useTask } from '@/core/react/hooks/use-task';
import { Loader } from '@/view/ui/feedback/Loader';
import { Box } from '@/view/ui/layout/Box';
import { Group } from '@/view/ui/layout/Layout'; // Импортируем Group
import { Overlay } from '@/view/ui/layout/Overlay';
import { LegendItem } from '@/view/ui/primitive/Legend'; // Импортируем LegendItem

interface FrameDiffOverlayProps {
  image1: string | null;
  image2: string | null;
  isProcessing: boolean;
  onDataGenerated?: (url: string | null) => void;
}

export function FrameDiffOverlay({
  image1,
  image2,
  isProcessing,
  onDataGenerated,
}: FrameDiffOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Автоматически отменяет предыдущий расчет при смене аргументов (быстрый скроллинг)
  const diffTask = useTask<string | null, [string, string]>(async ({ signal }, src1, src2) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const [firstImg, lastImg] = await Promise.all([loadImage(src1), loadImage(src2)]);

    if (signal.aborted) throw new Error('Aborted');

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Setup
    canvas.width = firstImg.width;
    canvas.height = firstImg.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const bg = getTopLeftPixelColor(firstImg);

    // 2. Capture Data
    const { ctx: ctx1 } = captureToCanvas(firstImg);
    const { ctx: ctx2 } = captureToCanvas(lastImg);
    const firstData = ctx1.getImageData(0, 0, canvas.width, canvas.height).data;
    const lastData = ctx2.getImageData(0, 0, canvas.width, canvas.height).data;
    const resultImageData = ctx.createImageData(canvas.width, canvas.height);
    const threshold = 30;

    // 3. Process Pixels
    for (let i = 0; i < firstData.length; i += 4) {
      const firstIsBg = areColorsSimilar(
        firstData[i] ?? 0,
        firstData[i + 1] ?? 0,
        firstData[i + 2] ?? 0,
        bg.r,
        bg.g,
        bg.b,
        threshold
      );
      const lastIsBg = areColorsSimilar(
        lastData[i] ?? 0,
        lastData[i + 1] ?? 0,
        lastData[i + 2] ?? 0,
        bg.r,
        bg.g,
        bg.b,
        threshold
      );

      if (firstIsBg && lastIsBg) {
        resultImageData.data[i + 3] = 0;
      } else if (!firstIsBg && lastIsBg) {
        // Исчезнувший (Красный)
        resultImageData.data[i] = 255;
        resultImageData.data[i + 3] = 200;
      } else if (firstIsBg && !lastIsBg) {
        // Появившийся (Синий)
        resultImageData.data[i + 2] = 255;
        resultImageData.data[i + 1] = 100; // Немного зеленого для красоты
        resultImageData.data[i + 3] = 200;
      } else {
        // Изменившийся (Фиолетовый)
        resultImageData.data[i] = 200;
        resultImageData.data[i + 1] = 50;
        resultImageData.data[i + 2] = 255;
        resultImageData.data[i + 3] = 220;
      }
    }

    ctx.putImageData(resultImageData, 0, 0);
    return canvas.toDataURL('image/png');
  });

  // Effect Trigger
  useEffect(() => {
    if (image1 && image2) {
      void diffTask.run(image1, image2);
    } else {
      diffTask.reset();
      onDataGenerated?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image1, image2]);

  // Sync parent callback with result
  useEffect(() => {
    if (diffTask.status === 'success') {
      onDataGenerated?.(diffTask.result);
    }
  }, [diffTask.status, diffTask.result, onDataGenerated]);

  const overlayDataUrl = diffTask.result;
  const isLoading = diffTask.isRunning || isProcessing;

  if (!image1 || !image2) {
    return (
      <div className="fx-center h-full w-full bg-zinc-100 dark:bg-zinc-800">
        <p className="text-[10px] text-zinc-400">Нет данных</p>
      </div>
    );
  }

  return (
    <Box className="group relative h-full w-full bg-zinc-100 dark:bg-zinc-950">
      <canvas ref={canvasRef} className="hidden" />
      {overlayDataUrl && (
        <Image
          src={overlayDataUrl}
          alt="Diff Overlay"
          fill
          unoptimized
          className="object-contain"
        />
      )}

      <Overlay center dim visible={isLoading}>
        <Loader size="md" />
      </Overlay>

      <Overlay
        gradient="bottom"
        className="flex items-end p-2 opacity-0 transition-opacity group-hover:opacity-100"
        visible={!!overlayDataUrl}
      >
        <Group gap={3} className="text-white">
          <LegendItem color="bg-red-500" label="Старт" />
          <LegendItem color="bg-blue-500" label="Финиш" />
        </Group>
      </Overlay>
    </Box>
  );
}
