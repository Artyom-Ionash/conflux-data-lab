'use client';

import * as SwitchPrimitives from '@radix-ui/react-switch';
import React from 'react';

import { type ElementProps } from '@/core/react/props';
import { cn } from '@/core/tailwind/utils';

interface SwitchProps extends Omit<ElementProps<HTMLDivElement>, 'onChange'> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}

export const Switch = ({
  checked,
  onCheckedChange,
  label,
  className = '',
  ...props
}: SwitchProps) => (
  <div className={cn('flex items-center justify-between gap-4 py-2', className)} {...props}>
    <label
      className="cursor-pointer text-sm font-medium text-zinc-700 select-none dark:text-zinc-300"
      onClick={() => onCheckedChange(!checked)}
    >
      {label}
    </label>
    <SwitchPrimitives.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="relative h-[24px] w-[42px] cursor-pointer rounded-full bg-zinc-300 shadow-inner transition-colors outline-none focus:shadow-black data-[state=checked]:bg-blue-600 dark:bg-zinc-700"
    >
      <SwitchPrimitives.Thumb className="block h-[20px] w-[20px] translate-x-0.5 rounded-full bg-white shadow transition-transform duration-100 will-change-transform data-[state=checked]:translate-x-[19px]" />
    </SwitchPrimitives.Root>
  </div>
);
