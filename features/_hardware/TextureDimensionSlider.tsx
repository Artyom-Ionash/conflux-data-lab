import React from 'react';

import {
  analyzeTextureSize,
  getNearestPoT,
  HARDWARE_STANDARD_YEAR,
  isPowerOfTwo,
  TEXTURE_LIMITS,
  TEXTURE_ZONES,
} from '@/lib/graphics/standards';
import { DimensionInput } from '@/ui/input/DimensionInput';
import { Stack } from '@/ui/layout/Layout';
import { Typography } from '@/ui/primitive/Typography';

interface TextureDimensionSliderProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  max?: number;
  disabled?: boolean;
}

export function TextureDimensionSlider({
  label,
  value,
  onChange,
  max = TEXTURE_LIMITS.MAX_SLIDER,
  disabled = false,
}: TextureDimensionSliderProps) {
  // 1. Вычисляем состояние (Pure Logic)
  const analysis = analyzeTextureSize(value);
  const isPoT = isPowerOfTwo(value);
  const nearestPoT = getNearestPoT(value || 1);

  // 2. Подготовка контента
  const tooltipContent = (
    <Stack gap={1}>
      <Typography.Text variant="default" weight="medium">
        {analysis.message}
      </Typography.Text>
      <Typography.Text variant="label" className="opacity-50">
        Hardware Standards {HARDWARE_STANDARD_YEAR}
      </Typography.Text>
    </Stack>
  );

  // 3. Рендер через UI компонент (Pure UI)
  return (
    <DimensionInput
      label={label}
      value={value}
      max={max}
      onChange={onChange}
      disabled={disabled}
      // Logic binding
      isPoT={isPoT}
      nearestPoT={nearestPoT}
      onPoTClick={() => onChange(nearestPoT)}
      // Status binding
      status={analysis.status}
      statusLabel={analysis.label}
      statusIcon={analysis.icon}
      message={tooltipContent}
      // Config binding
      zones={TEXTURE_ZONES.map((z) => ({ percent: z.percent, color: z.color }))}
      limitMax={TEXTURE_LIMITS.MAX_SLIDER}
    />
  );
}
