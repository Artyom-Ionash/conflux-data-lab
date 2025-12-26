'use client';

import React from 'react';

/**
 * Контейнер для "внутренних органов" инструментов (скрытых видео, канвасов).
 * Исключает технические теги из визуальной структуры JSX.
 *
 * ВАЖНО: Используется техника "Visual Hiding" вместо display: none.
 * Видео и Canvas должны присутствовать в Render Tree (иметь размеры),
 * чтобы работать API типа requestVideoFrameCallback.
 */
export function EngineRoom({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none fixed top-0 left-0 h-px w-px overflow-hidden opacity-0"
      style={{ zIndex: 'var(--z-deep)' }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}
