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
    <div className="space-y-1">
      <div className="font-medium">{analysis.message}</div>
      <div className="text-[10px] font-bold tracking-wider uppercase opacity-50">
        Hardware Standards {HARDWARE_STANDARD_YEAR}
      </div>
    </div>
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
