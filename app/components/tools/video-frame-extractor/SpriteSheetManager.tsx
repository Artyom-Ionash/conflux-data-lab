"use client";

import { useCallback, useState } from "react";
import { ExtractedFrame } from "./types";

function useSpriteSheetGenerator() {
  const generateSpriteSheet = useCallback(
    async (
      frames: ExtractedFrame[],
      options?: {
        maxHeight?: number;
        spacing?: number;
        backgroundColor?: string;
      }
    ) => {
      if (frames.length === 0) {
        throw new Error("Нет кадров для создания спрайт-листа");
      }

      const firstImage = new Image();
      await new Promise<void>((resolve) => {
        firstImage.onload = () => resolve();
        firstImage.src = frames[0].dataUrl;
      });

      const maxHeight = options?.maxHeight ?? 500;
      const spacing = options?.spacing ?? 0;
      const backgroundColor = options?.backgroundColor || "transparent";

      const scale = maxHeight / firstImage.height;
      const scaledWidth = Math.floor(firstImage.width * scale);
      const scaledHeight = maxHeight;

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Не удалось создать контекст канваса");
      }

      canvas.width = (scaledWidth + spacing) * frames.length - spacing;
      canvas.height = scaledHeight;

      if (backgroundColor !== "transparent") {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      for (let i = 0; i < frames.length; i++) {
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.src = frames[i].dataUrl;
        });

        const x = i * (scaledWidth + spacing);
        ctx.drawImage(img, x, 0, scaledWidth, scaledHeight);
      }

      if (spacing > 0) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
        ctx.lineWidth = 1;
        for (let i = 1; i < frames.length; i++) {
          const x = i * (scaledWidth + spacing) - spacing / 2;
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, scaledHeight);
          ctx.stroke();
        }
      }

      return canvas.toDataURL("image/png");
    },
    []
  );

  return { generateSpriteSheet };
}

interface SpriteSheetManagerProps {
  frames: ExtractedFrame[];
}

export function SpriteSheetManager({ frames }: SpriteSheetManagerProps) {
  const [spriteSheetUrl, setSpriteSheetUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [spriteOptions, setSpriteOptions] = useState({
    maxHeight: 500,
    spacing: 0,
    backgroundColor: "transparent" as "transparent" | "white" | "black",
  });

  const { generateSpriteSheet } = useSpriteSheetGenerator();

  const handleGenerateSpriteSheet = async () => {
    if (frames.length === 0) return;

    setIsGenerating(true);
    try {
      const dataUrl = await generateSpriteSheet(frames, {
        maxHeight: spriteOptions.maxHeight,
        spacing: spriteOptions.spacing,
        backgroundColor: spriteOptions.backgroundColor,
      });
      setSpriteSheetUrl(dataUrl);
    } catch (error) {
      console.error("Ошибка при создании спрайт-листа:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadSpriteSheet = () => {
    if (!spriteSheetUrl) return;
    const a = document.createElement("a");
    a.href = spriteSheetUrl;
    a.download = `sprite-sheet-${frames.length}-frames.png`;
    a.click();
  };

  if (frames.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Макс. высота (пикс)
          </label>
          <input
            type="range"
            min="50"
            max="500"
            step="10"
            value={spriteOptions.maxHeight}
            onChange={(e) =>
              setSpriteOptions((prev) => ({ ...prev, maxHeight: parseInt(e.target.value) }))
            }
            className="w-full"
          />
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            {spriteOptions.maxHeight}px
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Отступ между кадрами
          </label>
          <input
            type="range"
            min="0"
            max="20"
            step="1"
            value={spriteOptions.spacing}
            onChange={(e) =>
              setSpriteOptions((prev) => ({ ...prev, spacing: parseInt(e.target.value) }))
            }
            className="w-full"
          />
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            {spriteOptions.spacing}px
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Фон
          </label>
          <select
            value={spriteOptions.backgroundColor}
            onChange={(e) =>
              setSpriteOptions((prev) => ({
                ...prev,
                backgroundColor: e.target.value as "transparent" | "white" | "black",
              }))
            }
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="transparent">Прозрачный</option>
            <option value="white">Белый</option>
            <option value="black">Черный</option>
          </select>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleGenerateSpriteSheet}
          disabled={isGenerating || frames.length === 0}
          className="flex-1 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? "Создание..." : "Создать спрайт-лист (PNG)"}
        </button>

        {spriteSheetUrl && (
          <button
            onClick={downloadSpriteSheet}
            className="flex-1 rounded-md border border-green-600 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-50 dark:border-green-500 dark:text-green-400 dark:hover:bg-green-950/30"
          >
            Скачать спрайт-лист
          </button>
        )}
      </div>

      {spriteSheetUrl && (
        <div className="mt-4">
          <div className="rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="bg-zinc-50 dark:bg-zinc-800 p-2 text-xs text-zinc-600 dark:text-zinc-400">
              Предпросмотр спрайт-листа ({frames.length} кадров)
            </div>
            <div className="p-4 bg-zinc-100 dark:bg-zinc-900 overflow-x-auto">
              <img
                src={spriteSheetUrl}
                alt="Sprite sheet preview"
                className="max-w-full h-auto border border-zinc-300 dark:border-zinc-700"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


