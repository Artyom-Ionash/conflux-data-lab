'use client';

import React from 'react';

import { cn } from '@/core/tailwind/utils';

interface EngineRoomProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Семантический контейнер для "внутренних органов" инструментов.
 * Скрывает технические элементы (video, canvas refs) из визуального потока,
 * но оставляет их в DOM для API доступа.
 */
export function EngineRoom({ children, className }: EngineRoomProps) {
  return (
    <div className={cn('fx-engine-room', className)} aria-hidden="true">
      {children}
    </div>
  );
}
