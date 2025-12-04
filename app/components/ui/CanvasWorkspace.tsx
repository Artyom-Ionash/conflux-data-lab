'use client';

import React, { useRef, useState, useImperativeHandle, forwardRef, ReactNode } from 'react';

interface Point {
  x: number;
  y: number;
}

export interface CanvasTransform {
  scale: number;
  x: number;
  y: number;
}

export interface CanvasWorkspaceRef {
  resetView: (contentWidth?: number, contentHeight?: number) => void;
  getTransform: () => CanvasTransform;
  screenToWorld: (clientX: number, clientY: number) => Point;
}

interface CanvasWorkspaceProps {
  children: ReactNode;
  isLoading?: boolean;
  className?: string;
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
}

export const CanvasWorkspace = forwardRef<CanvasWorkspaceRef, CanvasWorkspaceProps>(
  ({ children, isLoading = false, className = '', minScale = 0.05, maxScale = 50, initialScale = 1 }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [transform, setTransform] = useState<CanvasTransform>({ scale: initialScale, x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);

    const panStartRef = useRef<Point | null>(null);
    const transformStartRef = useRef<CanvasTransform | null>(null);

    // --- API for Parents ---
    useImperativeHandle(ref, () => ({
      resetView: (contentWidth?: number, contentHeight?: number) => {
        if (!containerRef.current) return;
        const { clientWidth, clientHeight } = containerRef.current;

        let newScale = 1;
        let newX = 0;
        let newY = 0;

        if (contentWidth && contentHeight) {
          // Вычисляем масштаб, чтобы контент вписался с отступами
          const padding = 40;
          const scaleX = (clientWidth - padding) / contentWidth;
          const scaleY = (clientHeight - padding) / contentHeight;
          newScale = Math.min(1, Math.min(scaleX, scaleY));
          if (newScale <= 0) newScale = 1;

          newX = (clientWidth - contentWidth * newScale) / 2;
          newY = (clientHeight - contentHeight * newScale) / 2;
        } else {
          // Если размеры не переданы, сбрасываем в центр (при условии что контент начинается в 0,0)
          newX = clientWidth / 2;
          newY = clientHeight / 2;
        }

        setTransform({ scale: newScale, x: newX, y: newY });
      },
      getTransform: () => transform,
      screenToWorld: (clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const x = (clientX - rect.left - transform.x) / transform.scale;
        const y = (clientY - rect.top - transform.y) / transform.scale;
        return { x, y };
      }
    }));

    // --- Event Handlers ---

    const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomIntensity = 0.1;
      const direction = e.deltaY > 0 ? -1 : 1;
      const factor = 1 + (direction * zoomIntensity);

      let newScale = transform.scale * factor;
      newScale = Math.max(minScale, Math.min(newScale, maxScale));

      const scaleRatio = newScale / transform.scale;
      const newX = mouseX - (mouseX - transform.x) * scaleRatio;
      const newY = mouseY - (mouseY - transform.y) * scaleRatio;

      setTransform({ scale: newScale, x: newX, y: newY });
    };

    const handlePointerDown = (e: React.PointerEvent) => {
      // Средняя кнопка мыши (1) для панорамирования
      if (e.button === 1) {
        e.preventDefault();
        if (containerRef.current) {
          containerRef.current.setPointerCapture(e.pointerId);
        }
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
        transformStartRef.current = { ...transform };
      }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (isPanning && panStartRef.current && transformStartRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;

        setTransform({
          ...transform,
          x: transformStartRef.current.x + dx,
          y: transformStartRef.current.y + dy
        });
      }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      if (e.button === 1 && isPanning) {
        setIsPanning(false);
        panStartRef.current = null;
        transformStartRef.current = null;
      }
    };

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full overflow-hidden select-none touch-none ${className}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        style={{ cursor: isPanning ? 'grabbing' : 'default' }}
      >
        {/* 
            Слой трансформации.
            Мы передаем --canvas-scale как CSS переменную, 
            чтобы дочерние элементы могли использовать calc(1px / var(--canvas-scale))
            для сохранения постоянной толщины линий.
        */}
        <div
          className="absolute top-0 left-0 will-change-transform origin-top-left"
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            // @ts-ignore - CSS Custom Property
            '--canvas-scale': transform.scale
          }}
        >
          {children}
        </div>

        {/* Индикатор загрузки - всегда по центру вьюпорта */}
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px] pointer-events-none">
            <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-xl flex flex-col items-center gap-3">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">Обработка...</span>
            </div>
          </div>
        )}

        {/* Подсказка */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none opacity-50 text-[10px] text-zinc-500 bg-white/50 dark:bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
          Средняя кнопка мыши для перемещения
        </div>
      </div>
    );
  }
);

CanvasWorkspace.displayName = 'CanvasWorkspace';