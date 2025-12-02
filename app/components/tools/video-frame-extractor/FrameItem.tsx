"use client";

import { ExtractedFrame } from "./types";

interface FrameItemProps {
  frame: ExtractedFrame;
  index: number;
  onDownload: () => void;
}

export function FrameItem({ frame, index, onDownload }: FrameItemProps) {
  return (
    <div className="flex h-full w-40 flex-shrink-0 flex-col justify-between rounded-md border border-zinc-200 p-2 dark:border-zinc-700">
      <img
        src={frame.dataUrl}
        alt={`Кадр ${index + 1}`}
        className="w-full flex-1 rounded-md object-contain bg-zinc-100 dark:bg-zinc-800"
      />
      <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
        <span>{frame.time.toFixed(2)}s</span>
        <button
          onClick={onDownload}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Скачать
        </button>
      </div>
    </div>
  );
}


