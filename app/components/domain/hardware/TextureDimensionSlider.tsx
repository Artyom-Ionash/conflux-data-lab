import React, { useState } from 'react';
import {
  analyzeTextureSize,
  getNearestPoT,
  isPowerOfTwo,
  TEXTURE_LIMITS,
  TEXTURE_ZONES,
  HARDWARE_STANDARD_YEAR
} from '@/lib/domain/hardware/texture-standards';

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
  disabled = false
}: TextureDimensionSliderProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const { label: statusLabel, icon, message, styles } = analyzeTextureSize(value);
  const isPoT = isPowerOfTwo(value);
  const nearestPoT = getNearestPoT(value || 1);

  const percentage = Math.min((value / max) * 100, 100);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (!isNaN(val)) onChange(Math.min(val, max));
  };

  const handlePoTClick = () => {
    if (!isPoT && !disabled) {
      onChange(nearestPoT);
    }
  };

  return (
    <div className={`relative flex flex-col gap-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Header Label */}
      <div className="flex justify-between items-end">
        <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          {label}
        </label>

        {/* Status Badge */}
        <div
          className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 cursor-help transition-colors ${styles.bg} ${styles.border} ${styles.text}`}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <span>{icon}</span>
          <span>{statusLabel}</span>
        </div>
      </div>

      {/* Main Controls Row */}
      <div className="flex items-stretch gap-4 h-10">
        {/* Slider Input (Transparent Container) */}
        <div className="flex-1 flex items-center px-1">
          <input
            type="range"
            min={1}
            max={max}
            value={value}
            onChange={handleSliderChange}
            className={`w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/30 ${styles.slider}`}
          />
        </div>

        {/* Input & PoT Group */}
        <div className="flex flex-col w-20 shadow-sm rounded-lg overflow-hidden">
          {/* PoT Button (Top half) */}
          <button
            onClick={handlePoTClick}
            disabled={disabled}
            className={`flex-1 text-[9px] font-bold uppercase tracking-wide border transition-all flex items-center justify-center
              ${isPoT
                ? 'bg-green-600/90 text-white border-green-600 cursor-default'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-blue-600 hover:text-white hover:border-blue-600'
              } border-b-0 rounded-t-lg`}
            title={isPoT ? "Размер кратен степени двойки (Оптимально)" : `Округлить до ${nearestPoT}px`}
          >
            {isPoT ? '2ⁿ OK' : `2ⁿ → ${nearestPoT}`}
          </button>

          {/* Number Input (Bottom half) */}
          <div className="flex-1 flex items-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-b-lg px-1">
            <input
              type="number"
              value={value}
              onChange={handleInputChange}
              className="w-full bg-transparent text-xs text-center font-mono font-bold text-zinc-800 dark:text-zinc-200 focus:outline-none appearance-none"
            />
          </div>
        </div>
      </div>

      {/* Visual Bar (Mini Zone Indicator) */}
      <div className="relative h-1.5 w-full rounded-full overflow-hidden bg-zinc-200 dark:bg-zinc-800 mt-0.5">
        {/* Background Zones */}
        <div className="absolute inset-0 flex opacity-80">
          {TEXTURE_ZONES.map((zone, i) => (
            <div
              key={i}
              className={`bg-gradient-to-r ${zone.color} h-full`}
              style={{ width: `${zone.percent}%` }}
            />
          ))}
        </div>

        {/* Cursor */}
        <div
          className={`absolute top-0 bottom-0 w-2 -ml-1 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.5)] ring-1 ring-white/80 transition-all duration-75 ease-out ${styles.marker}`}
          style={{ left: `${percentage}%` }}
        />
      </div>

      {/* Tooltip Overlay */}
      {showTooltip && (
        <div className="absolute z-50 top-0 right-0 mt-7 w-64 pointer-events-none">
          <div className="bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 text-xs p-3 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 leading-relaxed animate-in fade-in zoom-in-95 duration-100">
            <div className="mb-2 font-medium">{message}</div>
            <div className="opacity-50 text-[10px] uppercase tracking-wider font-bold">
              Hardware Standards {HARDWARE_STANDARD_YEAR}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}