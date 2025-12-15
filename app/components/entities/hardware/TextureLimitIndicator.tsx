import React from 'react';

import { ZoneIndicator } from '@/app/components/primitives/ZoneIndicator';
import {
  analyzeTextureSize,
  HARDWARE_STANDARD_YEAR,
  TEXTURE_LIMITS,
  TEXTURE_ZONES,
} from '@/lib/modules/graphics/standards';

interface TextureLimitIndicatorProps {
  value: number;
  label?: string;
  className?: string;
}

export function TextureLimitIndicator({ value, label, className }: TextureLimitIndicatorProps) {
  const { message, label: statusLabel, styles } = analyzeTextureSize(value);

  const displayValue = value >= 10_000 ? (value / 1000).toFixed(1) + 'K' : value.toString() + 'px';

  const uiZones = TEXTURE_ZONES.map((zone) => ({
    percent: zone.percent,
    colorClass: zone.color,
  }));

  const tooltipContent = (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100 shadow-2xl ring-1 ring-white/5">
      <div className="mb-2 flex items-center gap-2 border-b border-zinc-800/80 pb-2">
        <div
          className={`h-2 w-2 rounded-full shadow-[0_0_8px_currentColor] ${styles.marker}`}
        ></div>
        <span className={`font-bold tracking-wide ${styles.text}`}>{statusLabel}</span>
        <span className="text-zinc-600">•</span>
        <span className="font-mono text-zinc-300">{value}px</span>
      </div>
      <div className="mb-2 text-zinc-300">{message}</div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] font-semibold tracking-wider uppercase opacity-40">
          Standards {HARDWARE_STANDARD_YEAR}
        </span>
      </div>
    </div>
  );

  return (
    <ZoneIndicator
      value={value}
      displayValue={displayValue}
      max={TEXTURE_LIMITS.MAX_SLIDER} // Исправлено: MAX_VISUALIZER -> MAX_SLIDER
      zones={uiZones}
      markerColorClass={styles.marker}
      label={label}
      tooltip={tooltipContent}
      className={className}
    />
  );
}
