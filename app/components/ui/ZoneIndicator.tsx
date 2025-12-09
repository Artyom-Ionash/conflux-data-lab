import React from "react";

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
  className = "",
}: ZoneIndicatorProps) {
  const percentage = Math.max(0, Math.min((value / max) * 100, 100));

  return (
    <div className={`group relative flex flex-col justify-center ${className}`}>
      {/* Label Row */}
      {label && (
        <div className="flex justify-between items-end mb-1.5 px-0.5">
          <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
            {label}
          </span>
          <span className="text-[10px] font-mono font-bold text-zinc-200 bg-zinc-800 px-1.5 rounded">
            {displayValue}
          </span>
        </div>
      )}

      {/* Bar Container */}
      <div className="relative h-3 w-full bg-zinc-900 rounded-sm shadow-inner cursor-help isolate">

        {/* Background Zones (Clipped) */}
        <div className="absolute inset-0 flex opacity-90 rounded-sm overflow-hidden">
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
          className="absolute top-[-3px] bottom-[-3px] w-1.5 z-20 transition-all duration-300 ease-out will-change-[left]"
          style={{ left: `calc(${percentage}% - 3px)` }}
        >
          {/* The Needle itself: White with dark borders for max contrast */}
          <div className="w-full h-full bg-white border-x border-black/40 shadow-[0_1px_3px_rgba(0,0,0,0.8)] rounded-[1px]" />

          {/* Colored Glow/Halo behind the needle */}
          <div
            className={`absolute inset-0 w-full h-full opacity-60 blur-[4px] transition-colors duration-300 ${markerColorClass}`}
          />
        </div>
      </div>

      {/* Tooltip Slot */}
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-72 pointer-events-none">
          <div className="animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-150 origin-bottom">
            {tooltip}
          </div>
        </div>
      )}
    </div>
  );
}