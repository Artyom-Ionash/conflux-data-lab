import React from 'react';

import {
  analyzeTextureSize,
  HARDWARE_STANDARD_YEAR,
  TEXTURE_LIMITS,
  TEXTURE_ZONES,
  type TextureStatus,
} from '@/lib/graphics/standards';
import { ZoneIndicator } from '@/view/ui/feedback/ZoneIndicator';

interface TextureLimitIndicatorProps {
  value: number;
  label?: string;
  className?: string;
}

// Маппинг цветов для маркера (дублирует UI логику, но в минимальном объеме для индикатора)
// В идеале ZoneIndicator должен сам уметь краситься от статуса, но пока так:
const STATUS_MARKER_COLORS: Record<TextureStatus, string> = {
  safe: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-orange-500',
  critical: 'bg-red-500',
};

// Маппинг цветов текста
const STATUS_TEXT_COLORS: Record<TextureStatus, string> = {
  safe: 'text-green-400',
  warning: 'text-yellow-400',
  danger: 'text-orange-400',
  critical: 'text-red-400',
};

export function TextureLimitIndicator({ value, label, className }: TextureLimitIndicatorProps) {
  const { message, label: statusLabel, status } = analyzeTextureSize(value);

  const displayValue = value >= 10_000 ? (value / 1000).toFixed(1) + 'K' : value.toString() + 'px';

  const uiZones = TEXTURE_ZONES.map((zone) => ({
    percent: zone.percent,
    colorClass: zone.color,
  }));

  const tooltipContent = (
    <div className="space-y-2">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
        <div
          className={`h-2 w-2 rounded-full shadow-[0_0_8px_currentColor] ${STATUS_MARKER_COLORS[status]}`}
        ></div>
        <span className={`font-bold tracking-wide ${STATUS_TEXT_COLORS[status]}`}>
          {statusLabel}
        </span>
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
      markerColorClass={STATUS_MARKER_COLORS[status]}
      label={label ?? ''}
      tooltip={tooltipContent}
      className={className ?? ''}
    />
  );
}
