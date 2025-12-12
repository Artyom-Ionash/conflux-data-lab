import React from 'react';

interface NumberStepperProps {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step,
  label,
  className = '',
  disabled = false,
}: NumberStepperProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // FIX: unicorn/prefer-number-properties (parseFloat -> Number.parseFloat - опционально, но лучше isNaN -> Number.isNaN)
    const val = Number.parseFloat(e.target.value);
    // FIX: unicorn/prefer-number-properties
    if (!Number.isNaN(val)) {
      onChange(val);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && (
        <span className="text-xs font-bold tracking-wide text-zinc-500 uppercase">{label}:</span>
      )}

      <div
        className={`flex h-8 items-center rounded-lg border shadow-sm transition-colors ${
          disabled
            ? 'cursor-default border-zinc-200 bg-zinc-100 opacity-80 dark:border-zinc-700 dark:bg-zinc-800'
            : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600'
        }`}
      >
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={handleChange}
          disabled={disabled}
          className={`h-full w-16 appearance-none rounded-lg bg-transparent px-1 text-center font-mono text-sm font-bold outline-none ${disabled ? 'pointer-events-none text-zinc-500' : 'text-zinc-700 dark:text-zinc-200'}`}
        />
      </div>
    </div>
  );
}
