"use client";

import React from "react";

interface TimeRangeSliderProps {
  startTime: number;
  endTime: number;
  duration: number | null;
  onTimeChange: (type: "start" | "end", value: number) => void;
}

export function TimeRangeSlider({
  startTime,
  endTime,
  duration,
  onTimeChange,
}: TimeRangeSliderProps) {
  if (!duration || duration <= 0) return null;

  const startPercent = (startTime / duration) * 100;
  const endPercent = (endTime / duration) * 100;

  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
        <span>Диапазон (сек)</span>
        <span>
          {startTime.toFixed(2)}s – {endTime.toFixed(2)}s
        </span>
      </div>

      <div className="relative h-8">
        <div className="absolute inset-y-3 left-0 right-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />

        {startTime < endTime && (
          <div
            className="absolute inset-y-3 rounded-full bg-blue-500/50"
            style={{
              left: `${startPercent}%`,
              right: `${100 - endPercent}%`,
            }}
          />
        )}

        <input
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={startTime}
          onChange={(e) => onTimeChange("start", Number(e.target.value))}
          className="range-dual absolute inset-x-0 top-0 z-20 w-full"
        />

        <input
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={endTime}
          onChange={(e) => onTimeChange("end", Number(e.target.value))}
          className="range-dual absolute inset-x-0 bottom-0 z-10 w-full"
        />
      </div>

      <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
        <span>0s</span>
        <span>{duration.toFixed(1)}s</span>
      </div>
    </div>
  );
}


