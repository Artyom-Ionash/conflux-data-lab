"use client";

import { useEffect, useRef, useState } from "react";

interface FrameDiffOverlayProps {
  image1: string | null;
  image2: string | null;
  isProcessing: boolean;
  onDataGenerated?: (url: string | null) => void;
}

export function FrameDiffOverlay({ image1, image2, isProcessing, onDataGenerated }: FrameDiffOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [overlayDataUrl, setOverlayDataUrl] = useState<string | null>(null);
  const [processingDiff, setProcessingDiff] = useState(false);

  useEffect(() => {
    if (!image1 || !image2) {
      setOverlayDataUrl(null);
      if (onDataGenerated) onDataGenerated(null);
      return;
    }

    const processFrames = async () => {
      setProcessingDiff(true);
      try {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas) return;

        const firstImg = new Image();
        const lastImg = new Image();

        await Promise.all([
          new Promise<void>((resolve, reject) => { firstImg.onload = () => resolve(); firstImg.onerror = reject; firstImg.src = image1; }),
          new Promise<void>((resolve, reject) => { lastImg.onload = () => resolve(); lastImg.onerror = reject; lastImg.src = image2; }),
        ]);

        canvas.width = firstImg.width;
        canvas.height = firstImg.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.drawImage(firstImg, 0, 0);
        const firstImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        ctx.drawImage(lastImg, 0, 0);
        const lastImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const bgR = firstImageData.data[0];
        const bgG = firstImageData.data[1];
        const bgB = firstImageData.data[2];

        const resultImageData = ctx.createImageData(canvas.width, canvas.height);
        const threshold = 30;

        for (let i = 0; i < firstImageData.data.length; i += 4) {
          const firstR = firstImageData.data[i];
          const firstG = firstImageData.data[i + 1];
          const firstB = firstImageData.data[i + 2];

          const lastR = lastImageData.data[i];
          const lastG = lastImageData.data[i + 1];
          const lastB = lastImageData.data[i + 2];

          const firstIsBg = Math.abs(firstR - bgR) < threshold && Math.abs(firstG - bgG) < threshold && Math.abs(firstB - bgB) < threshold;
          const lastIsBg = Math.abs(lastR - bgR) < threshold && Math.abs(lastG - bgG) < threshold && Math.abs(lastB - bgB) < threshold;

          if (firstIsBg && lastIsBg) {
            resultImageData.data[i + 3] = 0;
          } else if (!firstIsBg && lastIsBg) {
            resultImageData.data[i] = 255; resultImageData.data[i + 1] = 0; resultImageData.data[i + 2] = 0; resultImageData.data[i + 3] = 200;
          } else if (firstIsBg && !lastIsBg) {
            resultImageData.data[i] = 0; resultImageData.data[i + 1] = 100; resultImageData.data[i + 2] = 255; resultImageData.data[i + 3] = 200;
          } else {
            resultImageData.data[i] = 200; resultImageData.data[i + 1] = 50; resultImageData.data[i + 2] = 255; resultImageData.data[i + 3] = 220;
          }
        }

        ctx.putImageData(resultImageData, 0, 0);
        const url = canvas.toDataURL("image/png");
        setOverlayDataUrl(url);
        if (onDataGenerated) onDataGenerated(url);

      } catch (error) {
        console.error("Error processing diff:", error);
      } finally {
        setProcessingDiff(false);
      }
    };
    processFrames();
  }, [image1, image2]);

  const isLoading = processingDiff || isProcessing;

  if (!image1 || !image2) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-100 dark:bg-zinc-800">
        <p className="text-[10px] text-zinc-400">Нет данных</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-zinc-100 dark:bg-zinc-950 group">
      <canvas ref={canvasRef} className="hidden" />

      {overlayDataUrl && (
        <img
          src={overlayDataUrl}
          alt="Diff Overlay"
          className="absolute inset-0 w-full h-full object-contain"
        />
      )}

      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-black/60 backdrop-blur-[1px]">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600"></div>
        </div>
      )}

      {/* Overlay Legend */}
      {overlayDataUrl && (
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent flex gap-3 text-[10px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-red-500 shadow-sm" /> Старт</span>
          <span className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-blue-500 shadow-sm" /> Финиш</span>
        </div>
      )}
    </div>
  );
}