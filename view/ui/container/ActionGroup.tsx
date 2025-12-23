'use client';

import React from 'react';

import { cn } from '../../../core/tailwind/utils';

interface ActionGroupProps {
  children: React.ReactNode;
  className?: string;
  attached?: boolean;
}

/**
 * Контейнер для группировки кнопок действий.
 * Поддерживает режим "attached", когда кнопки визуально склеены.
 */
export function ActionGroup({ children, className = '', attached = false }: ActionGroupProps) {
  return (
    <div
      className={cn(
        'flex items-center',
        attached ? 'gap-0 shadow-sm' : 'gap-2',
        attached &&
          // Стили для склейки кнопок (любых, включая Button)
          '[&>button]:rounded-none [&>button]:border-r first:[&>button]:rounded-l-md last:[&>button]:rounded-r-md last:[&>button]:border-r-0',
        className
      )}
    >
      {children}
    </div>
  );
}
