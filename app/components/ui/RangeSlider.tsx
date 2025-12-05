"use client";

import * as Slider from "@radix-ui/react-slider";

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  minStepsBetweenThumbs?: number;
  className?: string;
  disabled?: boolean;
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  minStepsBetweenThumbs = 0,
  className,
  disabled = false,
}: RangeSliderProps) {
  return (
    <Slider.Root
      className={`relative flex h-5 w-full touch-none select-none items-center ${className || ""} ${disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      value={value}
      max={max}
      min={min}
      step={step}
      minStepsBetweenThumbs={minStepsBetweenThumbs}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <Slider.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <Slider.Range className="absolute h-full bg-blue-500/50" />
      </Slider.Track>

      <Slider.Thumb
        className="block h-3.5 w-3.5 cursor-pointer rounded-full border-2 border-white bg-blue-600 shadow-[0_0_0_1px_rgba(15,23,42,0.3)] transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 disabled:cursor-not-allowed"
        aria-label="Minimum value"
      />

      <Slider.Thumb
        className="block h-3.5 w-3.5 cursor-pointer rounded-full border-2 border-white bg-blue-600 shadow-[0_0_0_1px_rgba(15,23,42,0.3)] transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 disabled:cursor-not-allowed"
        aria-label="Maximum value"
      />
    </Slider.Root>
  );
}