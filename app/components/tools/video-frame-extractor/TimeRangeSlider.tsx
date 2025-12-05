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

  // Базовые стили для обоих ползунков (замена класса .range-dual из CSS)
  const sliderBaseClass = `
    absolute inset-x-0 w-full appearance-none bg-transparent focus:outline-none
    [&::-webkit-slider-runnable-track]:h-0 [&::-webkit-slider-runnable-track]:bg-transparent
    [&::-moz-range-track]:h-0 [&::-moz-range-track]:bg-transparent
    [&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:shadow-[0_0_0_1px_rgba(15,23,42,0.3)] [&::-webkit-slider-thumb]:cursor-pointer
    [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:bg-blue-600 [&::-moz-range-thumb]:shadow-[0_0_0_1px_rgba(15,23,42,0.3)] [&::-moz-range-thumb]:cursor-pointer
  `;

  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center justify-between text-xs font-medium text-zinc-700 dark:text-zinc-300">
        <span>Диапазон (сек)</span>
        <span>
          {startTime.toFixed(2)}s – {endTime.toFixed(2)}s
        </span>
      </div>

      <div className="relative h-8">
        {/* Фоновый трек */}
        <div className="absolute inset-y-3 left-0 right-0 rounded-full bg-zinc-200 dark:bg-zinc-800" />

        {/* Активная область (синяя полоска) */}
        {startTime < endTime && (
          <div
            className="absolute inset-y-3 rounded-full bg-blue-500/50"
            style={{
              left: `${startPercent}%`,
              right: `${100 - endPercent}%`,
            }}
          />
        )}

        {/* Ползунок начала */}
        <input
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={startTime}
          onChange={(e) => onTimeChange("start", Number(e.target.value))}
          className={`${sliderBaseClass} top-0 z-20`}
        />

        {/* Ползунок конца */}
        <input
          type="range"
          min={0}
          max={duration}
          step={0.01}
          value={endTime}
          onChange={(e) => onTimeChange("end", Number(e.target.value))}
          className={`${sliderBaseClass} bottom-0 z-10`}
        />
      </div>

      <div className="flex justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
        <span>0s</span>
        <span>{duration.toFixed(1)}s</span>
      </div>
    </div>
  );
}