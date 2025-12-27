import React from 'react';

import {
  analyzeTextureSize,
  HARDWARE_STANDARD_YEAR,
  TEXTURE_LIMITS,
  TEXTURE_ZONES,
  type TextureStatus,
} from '@/lib/graphics/standards';
import { ZoneIndicator } from '@/ui/feedback/ZoneIndicator';
import { Box } from '@/ui/layout/Box';
import { Group, Stack } from '@/ui/layout/Layout';
import { Typography } from '@/ui/primitive/Typography';

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
    <Stack gap={2}>
      <Group gap={2} className="border-b border-zinc-800 pb-2">
        <Box
          className={`h-2 w-2 rounded-full shadow-[0_0_8px_currentColor] ${STATUS_MARKER_COLORS[status]}`}
        />
        <Typography.Text
          variant="default"
          weight="bold"
          className={`tracking-wide ${STATUS_TEXT_COLORS[status]}`}
        >
          {statusLabel}
        </Typography.Text>
        <Typography.Text variant="dimmed">•</Typography.Text>
        <Typography.Text className="font-mono text-zinc-300">{value}px</Typography.Text>
      </Group>
      <Typography.Text className="text-zinc-300">{message}</Typography.Text>
      <Typography.Text variant="label" className="pt-1 opacity-40">
        Standards {HARDWARE_STANDARD_YEAR}
      </Typography.Text>
    </Stack>
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
