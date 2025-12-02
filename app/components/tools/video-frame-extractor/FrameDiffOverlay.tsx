"use client";

import { useEffect, useRef, useState } from "react";
import { ExtractedFrame } from "./types";

interface FrameDiffOverlayProps {
  frames: ExtractedFrame[];
  isExtracting: boolean;
}

export function FrameDiffOverlay({ frames, isExtracting }: FrameDiffOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [overlayDataUrl, setOverlayDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (frames.length < 2) {
      return;
    }

    const processFrames = async () => {
      setIsProcessing(true);
      try {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas) return;

        const firstImg = new Image();
        const lastImg = new Image();

        await Promise.all([
          new Promise<void>((resolve) => {
            firstImg.onload = () => resolve();
            firstImg.src = frames[0].dataUrl;
          }),
          new Promise<void>((resolve) => {
            lastImg.onload = () => resolve();
            lastImg.src = frames[frames.length - 1].dataUrl;
          }),
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

          const firstIsBg =
            Math.abs(firstR - bgR) < threshold &&
            Math.abs(firstG - bgG) < threshold &&
            Math.abs(firstB - bgB) < threshold;

          const lastIsBg =
            Math.abs(lastR - bgR) < threshold &&
            Math.abs(lastG - bgG) < threshold &&
            Math.abs(lastB - bgB) < threshold;

          if (firstIsBg && lastIsBg) {
            resultImageData.data[i + 3] = 0;
          } else if (!firstIsBg && lastIsBg) {
            resultImageData.data[i] = 255;
            resultImageData.data[i + 1] = 0;
            resultImageData.data[i + 2] = 0;
            resultImageData.data[i + 3] = 200;
          } else if (firstIsBg && !lastIsBg) {
            resultImageData.data[i] = 0;
            resultImageData.data[i + 1] = 100;
            resultImageData.data[i + 2] = 255;
            resultImageData.data[i + 3] = 200;
          } else {
            resultImageData.data[i] = 200;
            resultImageData.data[i + 1] = 50;
            resultImageData.data[i + 2] = 255;
            resultImageData.data[i + 3] = 220;
          }
        }

        ctx.putImageData(resultImageData, 0, 0);
        setOverlayDataUrl(canvas.toDataURL("image/png"));
      } catch (error) {
        console.error("Error processing frames:", error);
      } finally {
        setIsProcessing(false);
      }
    };

    processFrames();
  }, [frames]);

  const isLoading = isProcessing || isExtracting;

  if (frames.length < 2 && !overlayDataUrl && !isLoading) {
    return null;
  }

  return (
    <div className="space-y-3">
      <canvas ref={canvasRef} className="hidden" />

      <div className="relative overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800 min-h-[200px] flex items-center justify-center">
        {overlayDataUrl && (
          <img
            src={overlayDataUrl}
            alt="Frame difference overlay"
            className="w-full object-contain transition-opacity duration-300"
            style={{ maxHeight: "300px" }}
          />
        )}

        {isLoading && (
          <div
            className={`absolute inset-0 z-10 flex flex-col items-center justify-center 
            ${overlayDataUrl ? "bg-white/60 dark:bg-black/60 backdrop-blur-[2px]" : "bg-transparent"}`}
          >
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-600"></div>
            <p className="mt-2 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              {isExtracting ? "Извлечение кадров..." : "Обработка разницы..."}
            </p>
          </div>
        )}

        {!overlayDataUrl && !isLoading && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Извлеките минимум 2 кадра для отображения наложения
          </p>
        )}
      </div>

      {overlayDataUrl && (
        <>
          <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-red-600"></div>
              <span>Только в первом кадре ({frames[0]?.time.toFixed(1) ?? "?"}s)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-blue-600"></div>
              <span>Только в последнем кадре ({frames[frames.length - 1]?.time.toFixed(1) ?? "?"}s)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded bg-purple-600"></div>
              <span>В обоих кадрах</span>
            </div>
            <p className="mt-2 text-[10px]">
              Фон определяется по цвету левого верхнего пикселя
            </p>
          </div>
          <button
            onClick={() => {
              if (!overlayDataUrl) return;
              const a = document.createElement("a");
              a.href = overlayDataUrl;
              a.download = "frame-diff-overlay.png";
              a.click();
            }}
            className="rounded-md border border-blue-600 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:border-blue-500 dark:text-blue-400 dark:hover:bg-blue-950/30"
          >
            Скачать наложение
          </button>
        </>
      )}
    </div>
  );
}


