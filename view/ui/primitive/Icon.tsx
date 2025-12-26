import React from 'react';

import { cn } from '@/core/tailwind/utils';

import { VECTORS } from './_vectors';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

/**
 * Базовая обертка для SVG.
 * Обеспечивает единые defaults (размер, stroke, fill).
 */
const createIcon = (content: React.ReactNode, defaultProps: Partial<IconProps> = {}) => {
  const IconComponent = ({ className, viewBox = '0 0 24 24', ...props }: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('h-4 w-4', className)}
      {...defaultProps} // Специфичные настройки (например, fill для Play)
      {...props} // Переопределения извне
    >
      {content}
    </svg>
  );
  return IconComponent;
};

// Собираем публичный объект Icon
export const Icon = {
  ArrowLeft: createIcon(VECTORS.ArrowLeft),
  Close: createIcon(VECTORS.Close),

  // Media icons often need fill, not stroke
  Play: createIcon(VECTORS.Play, { fill: 'currentColor', stroke: 'none' }),
  Pause: createIcon(VECTORS.Pause, { fill: 'currentColor', stroke: 'none' }),

  UploadCloud: createIcon(VECTORS.UploadCloud, { strokeWidth: 1.5 }),
  Folder: createIcon(VECTORS.Folder, { strokeWidth: 1.5 }),
  Download: createIcon(VECTORS.Download, { strokeWidth: 2.5 }),
  Copy: createIcon(VECTORS.Copy),
  Check: createIcon(VECTORS.Check, { strokeWidth: 3 }),

  Spinner: createIcon(VECTORS.Spinner, { className: 'animate-spin' }),

  AutoContrast: createIcon(VECTORS.AutoContrast),
  Trash: createIcon(VECTORS.Trash),
  Crosshair: createIcon(VECTORS.Crosshair, { strokeWidth: 3 }),
  Placeholder: createIcon(VECTORS.Placeholder, { strokeWidth: 1.5 }),
};
