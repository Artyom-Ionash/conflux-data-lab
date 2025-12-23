import React from 'react';

import { TRANSPARENCY_PATTERN_CSS } from '../../../core/tailwind/utils';

interface CheckerboardProps {
  children?: React.ReactNode;
  className?: string;
  size?: number; // Размер клетки
  color1?: string;
  color2?: string;
}

export function Checkerboard({
  children,
  className = '',
  size = 20,
  color1 = '#333',
  color2 = 'transparent',
}: CheckerboardProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Background Pattern */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage: TRANSPARENCY_PATTERN_CSS(color1, color2),
          backgroundSize: `${size}px ${size}px`,
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
}
