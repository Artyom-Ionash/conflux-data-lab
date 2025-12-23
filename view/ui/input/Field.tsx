'use client';

import React, { useId } from 'react';

import { cn } from '../_infrastructure/standards';

interface FieldProps {
  label: React.ReactNode;
  children: React.ReactElement<{ id?: string }>;
  className?: string;
  error?: string;
  id?: string;
}

export function Field({ label, children, className, error, id: customId }: FieldProps) {
  const generatedId = useId();
  const id = customId || generatedId;

  return (
    // Заменили <Stack> на div + flex-col
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={id}
        // Заменили <Typography variant="label"> на прямые классы.
        // Да, это дублирование стилей, но это ЦЕНА ЗА ИЗОЛЯЦИЮ.
        // Теперь Field не сломается, если мы удалим Typography.
        className="cursor-pointer text-[10px] font-bold tracking-wider text-zinc-500 uppercase select-none dark:text-zinc-400"
      >
        {label}
      </label>

      {/* Клонируем ребенка, чтобы насильно прокинуть ему ID */}
      {React.cloneElement(children, { id })}

      {error && (
        // Заменили <Typography variant="error"> на прямые классы
        <span className="animate-in slide-in-from-top-1 text-[10px] font-medium text-red-600 dark:text-red-500">
          {error}
        </span>
      )}
    </div>
  );
}
