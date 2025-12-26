import React from 'react';

import { cn, TRANSPARENCY_PATTERN_CSS } from '@/core/tailwind/utils';

interface CheckerboardProps {
  children?: React.ReactNode;
  className?: string;
  size?: number; // Размер клетки
  color1?: string; // Цвет клеток
  color2?: string; // "Прозрачный" цвет
  baseColor?: string; // Подложка
}

export function Checkerboard({
  children,
  className = '',
  size = 20,
  color1 = '#ccc', // Чуть темнее для контраста
  color2 = 'transparent',
  baseColor = 'bg-white dark:bg-zinc-900', // Непрозрачная подложка по умолчанию
}: CheckerboardProps) {
  // Рассчитываем смещения для корректной сборки паттерна из 4-х градиентов
  const half = size / 2;
  const positions = `0 0, 0 ${half}px, ${half}px -${half}px, -${half}px 0px`;

  return (
    <div className={cn('relative overflow-hidden', baseColor, className)}>
      {/* Background Pattern */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-25"
        style={{
          backgroundImage: TRANSPARENCY_PATTERN_CSS(color1, color2),
          backgroundSize: `${size}px ${size}px`,
          backgroundPosition: positions, // <--- Критическое исправление
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
}
