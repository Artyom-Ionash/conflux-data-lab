'use client';

import React from 'react';

/**
 * Контейнер для "внутренних органов" инструментов (скрытых видео, канвасов).
 * Исключает технические теги из визуальной структуры JSX.
 */
export function EngineRoom({ children }: { children: React.ReactNode }) {
  return (
    <div className="hidden" aria-hidden="true">
      {children}
    </div>
  );
}
