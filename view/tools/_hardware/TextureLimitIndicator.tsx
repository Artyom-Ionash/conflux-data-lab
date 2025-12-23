import React from 'react';

import {
  analyzeTextureSize,
  HARDWARE_STANDARD_YEAR,
  TEXTURE_LIMITS,
  TEXTURE_ZONES,
} from '@/lib/graphics/standards';
import { ZoneIndicator } from '@/view/ui/feedback/ZoneIndicator';

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

  // Содержимое подсказки теперь не содержит логики позиционирования
  const tooltipContent = (
    <div className="space-y-2">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <div
          className={`h-2 w-2 rounded-full shadow-[0_0_8px_currentColor] ${styles.marker}`}
        ></div>
        <span className={`font-bold tracking-wide ${styles.text}`}>{statusLabel}</span>
        <span className="text-zinc-600">•</span>
        <span className="font-mono text-zinc-300">{value}px</span>
      </div>
      <div className="text-zinc-300">{message}</div>
      <div className="pt-1 text-[10px] font-semibold tracking-wider uppercase opacity-40">
        Standards {HARDWARE_STANDARD_YEAR}
      </div>
    </div>
  );

  return (
    <ZoneIndicator
      value={value}
      displayValue={displayValue}
      max={TEXTURE_LIMITS.MAX_SLIDER}
      zones={uiZones}
      markerColorClass={styles.marker}
      label={label ?? ''}
      tooltip={tooltipContent}
      className={className ?? ''}
    />
  );
}
