"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  minStepsBetweenThumbs?: number;
  className?: string;
  formatTooltip?: (value: number) => string;
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  minStepsBetweenThumbs = 0,
  className = "",
  formatTooltip,
}: RangeSliderProps) {
  const [isDragging, setIsDragging] = useState<"min" | "max" | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    value: number;
    pixelX: number;
    targetThumb: "min" | "max";
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---

  const getPercent = useCallback(
    (val: number) => ((val - min) / (max - min)) * 100,
    [min, max]
  );

  const getValueFromPointer = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return min;
      const rect = containerRef.current.getBoundingClientRect();
      const percentage = Math.min(
        1,
        Math.max(0, (clientX - rect.left) / rect.width)
      );
      const rawValue = min + percentage * (max - min);
      const steppedValue = Math.round(rawValue / step) * step;
      return Number(steppedValue.toFixed(2));
    },
    [min, max, step]
  );

  // --- Handlers ---

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const newValue = getValueFromPointer(e.clientX);

    const distMin = Math.abs(newValue - value[0]);
    const distMax = Math.abs(newValue - value[1]);

    let target: "min" | "max";
    if (distMin < distMax) target = "min";
    else target = "max";

    const nextValues = [...value] as [number, number];
    if (target === "min") {
      const limit = value[1] - step * minStepsBetweenThumbs;
      nextValues[0] = Math.min(newValue, limit);
    } else {
      const limit = value[0] + step * minStepsBetweenThumbs;
      nextValues[1] = Math.max(newValue, limit);
    }

    onValueChange(nextValues);
    setIsDragging(target);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const valUnderCursor = getValueFromPointer(e.clientX);

    // 1. Logic: Dragging
    if (isDragging && containerRef.current) {
      const nextValues = [...value] as [number, number];
      if (isDragging === "min") {
        const limit = value[1] - step * minStepsBetweenThumbs;
        nextValues[0] = Math.min(Math.max(valUnderCursor, min), limit);
      } else {
        const limit = value[0] + step * minStepsBetweenThumbs;
        nextValues[1] = Math.max(Math.min(valUnderCursor, max), limit);
      }
      onValueChange(nextValues);
      return;
    }

    // 2. Logic: Hovering
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const pixelX = e.clientX - rect.left;

      const distMin = Math.abs(valUnderCursor - value[0]);
      const distMax = Math.abs(valUnderCursor - value[1]);
      const targetThumb = distMin <= distMax ? "min" : "max";

      setHoverInfo({
        value: valUnderCursor,
        pixelX,
        targetThumb,
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(null);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handlePointerLeave = () => {
    if (!isDragging) {
      setHoverInfo(null);
    }
  };

  // --- Render Calculation ---
  const minPercent = getPercent(value[0]);
  const maxPercent = getPercent(value[1]);

  // Вычисляем данные для тултипа (единая логика для Drag и Hover)
  let tooltipData = null;

  if (isDragging) {
    // Режим перетаскивания: показываем реальное значение ползунка
    const activeVal = isDragging === "min" ? value[0] : value[1];
    tooltipData = {
      value: activeVal,
      label: isDragging === "min" ? "Start" : "End",
      isMin: isDragging === "min",
      // При драге позиционируем по процентам (привязано к ползунку)
      style: { left: `${getPercent(activeVal)}%` }
    };
  } else if (hoverInfo) {
    // Режим ховера: показываем значение под курсором
    tooltipData = {
      value: hoverInfo.value,
      label: hoverInfo.targetThumb === "min" ? "Start" : "End",
      isMin: hoverInfo.targetThumb === "min",
      // При ховере позиционируем по пикселям курсора
      style: { left: hoverInfo.pixelX }
    };
  }

  return (
    <div
      className={`relative w-full h-6 flex items-center select-none touch-none group ${className}`}
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      {/* Background Track */}
      <div className="absolute w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
        {/* Active Range */}
        <div
          className="absolute h-full bg-blue-500 dark:bg-blue-600 opacity-80"
          style={{
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
          }}
        />
      </div>

      {/* Unified Tooltip */}
      {tooltipData && (
        <div
          className="absolute top-0 transform -translate-x-1/2 -translate-y-full pointer-events-none z-30 pb-2 transition-all duration-75"
          style={tooltipData.style}
        >
          <div className="bg-zinc-900 text-white text-[10px] font-mono py-1 px-2 rounded shadow-lg border border-zinc-700 whitespace-nowrap flex items-center gap-1.5">
            <span className="font-bold">
              {formatTooltip ? formatTooltip(tooltipData.value) : tooltipData.value.toFixed(2)}
            </span>
            <span className={`text-[9px] uppercase tracking-wide flex items-center font-bold ${tooltipData.isMin ? 'text-blue-400' : 'text-purple-400'}`}>
              {tooltipData.isMin ? '← Start' : 'End →'}
            </span>
          </div>
          {/* Triangle */}
          <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-zinc-700 absolute left-1/2 -translate-x-1/2 bottom-1" />
        </div>
      )}

      {/* Thumbs */}
      {/* Min Thumb */}
      <div
        className={`absolute w-4 h-4 rounded-full shadow-md border-2 transition-transform duration-75
          ${isDragging === "min" ? "scale-125 border-blue-500 bg-white z-20" : "bg-white border-zinc-300 dark:border-zinc-500 z-10"}
          ${(hoverInfo?.targetThumb === "min" && !isDragging) ? "ring-2 ring-blue-400/50 scale-110" : ""}
        `}
        style={{ left: `calc(${minPercent}% - 8px)` }}
      />

      {/* Max Thumb */}
      <div
        className={`absolute w-4 h-4 rounded-full shadow-md border-2 transition-transform duration-75
          ${isDragging === "max" ? "scale-125 border-blue-500 bg-white z-20" : "bg-white border-zinc-300 dark:border-zinc-500 z-10"}
          ${(hoverInfo?.targetThumb === "max" && !isDragging) ? "ring-2 ring-purple-400/50 scale-110" : ""}
        `}
        style={{ left: `calc(${maxPercent}% - 8px)` }}
      />
    </div>
  );
}