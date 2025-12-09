import React from 'react';
import { ZoneIndicator } from '@/app/components/ui/ZoneIndicator';
import {
  analyzeTextureSize,
  TEXTURE_LIMITS,
  TEXTURE_ZONES,
  HARDWARE_STANDARD_YEAR
} from '@/lib/domain/hardware/texture-standards';

interface TextureLimitIndicatorProps {
  value: number;
  label?: string;
  className?: string;
}

export function TextureLimitIndicator({ value, label, className }: TextureLimitIndicatorProps) {
  const { message, label: statusLabel, styles } = analyzeTextureSize(value);

  const displayValue = value >= 10000
    ? (value / 1000).toFixed(1) + 'K'
    : value.toString() + 'px';

  const uiZones = TEXTURE_ZONES.map(zone => ({
    percent: zone.percent,
    colorClass: zone.color
  }));

  const tooltipContent = (
    <div className="bg-zinc-950 text-zinc-100 text-xs p-3 rounded-lg shadow-2xl border border-zinc-800 leading-relaxed ring-1 ring-white/5">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-800/80">
        <div className={`w-2 h-2 rounded-full shadow-[0_0_8px_currentColor] ${styles.marker}`}></div>
        <span className={`font-bold tracking-wide ${styles.text}`}>{statusLabel}</span>
        <span className="text-zinc-600">•</span>
        <span className="font-mono text-zinc-300">{value}px</span>
      </div>
      <div className="mb-2 text-zinc-300">{message}</div>
      <div className="flex justify-between items-center pt-1">
        <span className="opacity-40 text-[10px] uppercase tracking-wider font-semibold">
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