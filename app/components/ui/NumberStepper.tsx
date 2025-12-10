import React from "react";

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
  className = "",
  disabled = false
}: NumberStepperProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      onChange(val);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide">{label}:</span>}

      <div className={`flex items-center h-8 border rounded-lg shadow-sm transition-colors 
        ${disabled
          ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 cursor-default opacity-80"
          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
        }`}>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={handleChange}
          disabled={disabled}
          className={`w-16 h-full text-center text-sm font-mono font-bold bg-transparent outline-none appearance-none rounded-lg px-1
            ${disabled ? "text-zinc-500 pointer-events-none" : "text-zinc-700 dark:text-zinc-200"}`}
        />
      </div>
    </div>
  );
}