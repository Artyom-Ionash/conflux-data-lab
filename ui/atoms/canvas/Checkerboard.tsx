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
  color1 = '#ccc',
  color2 = 'transparent',
  baseColor = 'bg-white',
}: CheckerboardProps) {
  // Рассчитываем смещения для корректной сборки паттерна из 4-х градиентов
  const half = size / 2;
  const positions = `0 0, 0 ${half}px, ${half}px -${half}px, -${half}px 0px`;

  return (
    <div className={cn('relative overflow-hidden', baseColor, className)}>
      {/* 
         Background Pattern 
         absolute позиционирование вынимает его из потока, 
         но в DOM он идет первым, поэтому лежит ниже relative-соседей.
      */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: TRANSPARENCY_PATTERN_CSS(color1, color2),
          backgroundSize: `${size}px ${size}px`,
          backgroundPosition: positions,
        }}
      />

      {/* 
         Content
         relative позиционирование поднимает его над absolute-слоем (если z-index auto).
      */}
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}
