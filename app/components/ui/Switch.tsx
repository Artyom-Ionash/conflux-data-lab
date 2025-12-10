'use client';

import * as SwitchPrimitives from '@radix-ui/react-switch';
import React from 'react';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  className?: string;
}

export const Switch = ({ checked, onCheckedChange, label, className = '' }: SwitchProps) => (
  <div className={`flex items-center justify-between py-2 ${className}`}>
    <label
      className="text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer select-none"
      onClick={() => onCheckedChange(!checked)}
    >
      {label}
    </label>
    <SwitchPrimitives.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="w-[42px] h-[24px] bg-zinc-300 rounded-full relative shadow-inner focus:shadow-black outline-none cursor-pointer data-[state=checked]:bg-blue-600 dark:bg-zinc-700 transition-colors"
    >
      <SwitchPrimitives.Thumb className="block w-[20px] h-[20px] bg-white rounded-full shadow transition-transform duration-100 translate-x-0.5 will-change-transform data-[state=checked]:translate-x-[19px]" />
    </SwitchPrimitives.Root>
  </div>
);