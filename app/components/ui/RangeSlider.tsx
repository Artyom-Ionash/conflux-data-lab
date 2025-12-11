'use client';

import React, { useCallback, useRef, useState } from 'react';

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  // Обновленная сигнатура: передаем индекс активного ползунка (0 или 1)
  onValueChange: (value: [number, number], thumbIndex?: 0 | 1) => void;
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
  className = '',
  formatTooltip,
}: RangeSliderProps) {
  const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);
  const [hoverInfo, setHoverInfo] = useState<{
    value: number;
    pixelX: number;
    targetThumb: 'min' | 'max';
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---

  const getPercent = useCallback((val: number) => ((val - min) / (max - min)) * 100, [min, max]);

  const getValueFromPointer = useCallback(
    (clientX: number) => {
      if (!containerRef.current) return min;
      const rect = containerRef.current.getBoundingClientRect();
      const percentage = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
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

    let target: 'min' | 'max';
    if (distMin < distMax) target = 'min';
    else target = 'max';

    const nextValues = [...value] as [number, number];
    // Определяем индекс для колбэка
    const activeIndex = target === 'min' ? 0 : 1;

    if (target === 'min') {
      const limit = value[1] - step * minStepsBetweenThumbs;
      nextValues[0] = Math.min(newValue, limit);
    } else {
      const limit = value[0] + step * minStepsBetweenThumbs;
      nextValues[1] = Math.max(newValue, limit);
    }

    // Передаем activeIndex родителю
    onValueChange(nextValues, activeIndex);
    setIsDragging(target);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const valUnderCursor = getValueFromPointer(e.clientX);

    // 1. Logic: Dragging
    if (isDragging && containerRef.current) {
      const nextValues = [...value] as [number, number];
      const activeIndex = isDragging === 'min' ? 0 : 1;

      if (isDragging === 'min') {
        const limit = value[1] - step * minStepsBetweenThumbs;
        nextValues[0] = Math.min(Math.max(valUnderCursor, min), limit);
      } else {
        const limit = value[0] + step * minStepsBetweenThumbs;
        nextValues[1] = Math.max(Math.min(valUnderCursor, max), limit);
      }

      // Передаем activeIndex родителю
      onValueChange(nextValues, activeIndex);
      return;
    }

    // 2. Logic: Hovering
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const pixelX = e.clientX - rect.left;

      const distMin = Math.abs(valUnderCursor - value[0]);
      const distMax = Math.abs(valUnderCursor - value[1]);
      const targetThumb = distMin <= distMax ? 'min' : 'max';

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

  let tooltipData = null;

  if (isDragging) {
    const activeVal = isDragging === 'min' ? value[0] : value[1];
    tooltipData = {
      value: activeVal,
      label: isDragging === 'min' ? 'Start' : 'End',
      isMin: isDragging === 'min',
      style: { left: `${getPercent(activeVal)}%` },
    };
  } else if (hoverInfo) {
    tooltipData = {
      value: hoverInfo.value,
      label: hoverInfo.targetThumb === 'min' ? 'Start' : 'End',
      isMin: hoverInfo.targetThumb === 'min',
      style: { left: hoverInfo.pixelX },
    };
  }

  return (
    <div
      className={`group relative flex h-6 w-full touch-none items-center select-none ${className}`}
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
    >
      <div className="absolute h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        <div
          className="absolute h-full bg-blue-500 opacity-80 dark:bg-blue-600"
          style={{
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
          }}
        />
      </div>

      {tooltipData && (
        <div
          className="pointer-events-none absolute top-0 z-30 -translate-x-1/2 -translate-y-full transform pb-2 transition-all duration-75"
          style={tooltipData.style}
        >
          <div className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-[10px] whitespace-nowrap text-white shadow-lg">
            <span className="font-bold">
              {formatTooltip ? formatTooltip(tooltipData.value) : tooltipData.value.toFixed(2)}
            </span>
            <span
              className={`flex items-center text-[9px] font-bold tracking-wide uppercase ${tooltipData.isMin ? 'text-blue-400' : 'text-purple-400'}`}
            >
              {tooltipData.isMin ? '← Start' : 'End →'}
            </span>
          </div>
          <div className="absolute bottom-1 left-1/2 h-0 w-0 -translate-x-1/2 border-t-[4px] border-r-[4px] border-l-[4px] border-t-zinc-700 border-r-transparent border-l-transparent" />
        </div>
      )}

      {/* Min Thumb */}
      <div
        className={`absolute h-4 w-4 rounded-full border-2 shadow-md transition-transform duration-75 ${isDragging === 'min' ? 'z-20 scale-125 border-blue-500 bg-white' : 'z-10 border-zinc-300 bg-white dark:border-zinc-500'} ${hoverInfo?.targetThumb === 'min' && !isDragging ? 'scale-110 ring-2 ring-blue-400/50' : ''} `}
        style={{ left: `calc(${minPercent}% - 8px)` }}
      />

      {/* Max Thumb */}
      <div
        className={`absolute h-4 w-4 rounded-full border-2 shadow-md transition-transform duration-75 ${isDragging === 'max' ? 'z-20 scale-125 border-blue-500 bg-white' : 'z-10 border-zinc-300 bg-white dark:border-zinc-500'} ${hoverInfo?.targetThumb === 'max' && !isDragging ? 'scale-110 ring-2 ring-purple-400/50' : ''} `}
        style={{ left: `calc(${maxPercent}% - 8px)` }}
      />
    </div>
  );
}
