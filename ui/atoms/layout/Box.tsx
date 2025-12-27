import { Slot } from '@radix-ui/react-slot';
import React, { forwardRef } from 'react';

import { type PolymorphicProps } from '@/core/react/props';
import { cn } from '@/core/tailwind/utils';

interface BoxProps extends PolymorphicProps<HTMLDivElement> {
  // Можно добавить шорткаты для частых паттернов, если нужно
  center?: boolean;
}

/**
 * Базовый строительный блок UI.
 * Заменяет <div> для стилизации, отступов и позиционирования.
 * Поддерживает полиморфизм (asChild).
 */
export const Box = forwardRef<HTMLDivElement, BoxProps>(
  ({ className, asChild, center, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'div';

    return (
      <Comp
        ref={ref}
        className={cn(center && 'flex items-center justify-center', className)}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);

Box.displayName = 'Box';
