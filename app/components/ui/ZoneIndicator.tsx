import React from 'react';

export interface Zone {
  colorClass: string;
  percent: number;
}

export interface ZoneIndicatorProps {
  value: number;
  displayValue: string;
  max: number;
  zones: Zone[];
  markerColorClass: string; // Теперь это класс для цветной тени/свечения
  label?: string;
  tooltip?: React.ReactNode;
  className?: string;
}

export function ZoneIndicator({
  value,
  displayValue,
  max,
  zones,
  markerColorClass, // Используем для цветного "Glow" эффекта
  label,
  tooltip,
  className = '',
}: ZoneIndicatorProps) {
  const percentage = Math.max(0, Math.min((value / max) * 100, 100));

  return (
    <div className={`group relative flex flex-col justify-center ${className}`}>
      {/* Label Row */}
      {label && (
        <div className="mb-1.5 flex items-end justify-between px-0.5">
          <span className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
            {label}
          </span>
          <span className="rounded bg-zinc-800 px-1.5 font-mono text-[10px] font-bold text-zinc-200">
            {displayValue}
          </span>
        </div>
      )}

      {/* Bar Container */}
      <div className="relative isolate h-3 w-full cursor-help rounded-sm bg-zinc-900 shadow-inner">
        {/* Background Zones (Clipped) */}
        <div className="absolute inset-0 flex overflow-hidden rounded-sm opacity-90">
          {zones.map((zone, idx) => (
            <div
              key={idx}
              className={`bg-gradient-to-r ${zone.colorClass} border-r border-black/10 last:border-0`}
              style={{ flexBasis: `${zone.percent}%` }}
            />
          ))}
        </div>

        {/* Cursor Marker (High Contrast) */}
        <div
          className="absolute top-[-3px] bottom-[-3px] z-20 w-1.5 transition-all duration-300 ease-out will-change-[left]"
          style={{ left: `calc(${percentage}% - 3px)` }}
        >
          {/* The Needle itself: White with dark borders for max contrast */}
          <div className="h-full w-full rounded-[1px] border-x border-black/40 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.8)]" />

          {/* Colored Glow/Halo behind the needle */}
          <div
            className={`absolute inset-0 h-full w-full opacity-60 blur-[4px] transition-colors duration-300 ${markerColorClass}`}
          />
        </div>
      </div>

      {/* Tooltip Slot */}
      {tooltip && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-72 -translate-x-1/2 group-hover:block">
          <div className="animate-in fade-in zoom-in-95 slide-in-from-bottom-2 origin-bottom duration-150">
            {tooltip}
          </div>
        </div>
      )}
    </div>
  );
}
