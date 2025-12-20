'use client';

import React, { useCallback, useRef, useState } from 'react';

import { cn } from '@/view/ui/infrastructure/standards';

interface Position {
  x: number;
  y: number;
}

interface CanvasMovableProps {
  x: number;
  y: number;
  /** Текущий масштаб. Можно передать функцию для получения актуального значения без ре-рендера. */
  scale: number | (() => number);
  onMove: (newPos: Position) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode | ((isDragging: boolean) => React.ReactNode);
  disabled?: boolean;
}

export function CanvasMovable({
  x,
  y,
  scale,
  onMove,
  onDragStart,
  onDragEnd,
  className,
  style,
  children,
  disabled = false,
}: CanvasMovableProps) {
  const [isDragging, setIsDragging] = useState(false);

  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return;

      e.stopPropagation();

      const target = e.currentTarget;
      target.setPointerCapture(e.pointerId);

      setIsDragging(true);
      dragStateRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialX: x,
        initialY: y,
      };

      onDragStart?.();
    },
    [disabled, x, y, onDragStart]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStateRef.current) return;

      e.stopPropagation();

      const { startX, startY, initialX, initialY } = dragStateRef.current;

      // FIX: Получаем актуальный масштаб динамически, если передана функция.
      // Это решает проблему рассинхрона при зуме, так как стейт React может запаздывать.
      const currentScale = typeof scale === 'function' ? scale() : scale;

      const dx = (e.clientX - startX) / currentScale;
      const dy = (e.clientY - startY) / currentScale;

      onMove({
        x: initialX + dx,
        y: initialY + dy,
      });
    },
    [scale, onMove]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStateRef.current) return;

      e.stopPropagation();
      const target = e.currentTarget;
      target.releasePointerCapture(e.pointerId);

      setIsDragging(false);
      dragStateRef.current = null;
      onDragEnd?.();
    },
    [onDragEnd]
  );

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={cn(
        'absolute touch-none select-none',
        disabled ? 'cursor-default' : isDragging ? 'cursor-grabbing' : 'cursor-grab',
        className
      )}
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${x}px, ${y}px, 0)`,
        ...style,
      }}
    >
      {typeof children === 'function' ? children(isDragging) : children}
    </div>
  );
}
