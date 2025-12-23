'use client';

import React, {
  forwardRef,
  type ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { cn } from '@/core/tailwind/utils';
import type { CanvasRef } from '@/view/ui/canvas/Canvas';
import { Canvas } from '@/view/ui/canvas/Canvas';
import { ProcessingOverlay } from '@/view/ui/feedback/ProcessingOverlay';
import { ColorInput } from '@/view/ui/input/ColorInput';

// --- CONFIG ---

const ANIMATION_CONFIG = {
  AUTO_CONTRAST_PERIOD_DEFAULT: 5, // секунд
};

interface WorkbenchCanvasProps {
  children: ReactNode;
  isLoading?: boolean | undefined;
  contentWidth?: number | undefined;
  contentHeight?: number | undefined;
  shadowOverlayOpacity?: number | undefined;
  showTransparencyGrid?: boolean | undefined;
  defaultBackgroundColor?: string | undefined;
  placeholder?: ReactNode | undefined;
  className?: string | undefined;
  minScale?: number | undefined;
  maxScale?: number | undefined;
  initialScale?: number | undefined;
}

/**
 * "Умная" обертка над примитивом Canvas.
 * Содержит тулбар, управление темой, фоном и оверлей загрузки.
 * Реализует стандартный UX "Верстака" для всех графических инструментов.
 */
export const WorkbenchCanvas = forwardRef<CanvasRef, WorkbenchCanvasProps>(
  (
    {
      children,
      isLoading = false,
      contentWidth,
      contentHeight,
      shadowOverlayOpacity,
      showTransparencyGrid,
      defaultBackgroundColor,
      placeholder,
      className,
      minScale,
      maxScale,
      initialScale,
    },
    ref
  ) => {
    // --- State ---
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [isAutoContrast, setIsAutoContrast] = useState(false);
    const [autoContrastPeriod, setAutoContrastPeriod] = useState(
      ANIMATION_CONFIG.AUTO_CONTRAST_PERIOD_DEFAULT
    );
    const [backgroundColor, setBackgroundColor] = useState<string | null>(
      defaultBackgroundColor || null
    );

    // --- Refs ---
    const canvasRef = useRef<CanvasRef>(null);
    const zoomLabelRef = useRef<HTMLSpanElement>(null);

    // --- Logic ---

    // Forwarding ref methods to the inner Canvas
    useImperativeHandle(ref, () => ({
      resetView: (w, h) => canvasRef.current?.resetView(w, h),
      getTransform: () => canvasRef.current?.getTransform() || { scale: 1, x: 0, y: 0 },
      screenToWorld: (x, y) => canvasRef.current?.screenToWorld(x, y) || { x: 0, y: 0 },
      getBackgroundColor: () => backgroundColor,
      setBackgroundColor: (color) => setBackgroundColor(color),
    }));

    const handleResetView = useCallback(() => {
      canvasRef.current?.resetView();
    }, []);

    // Auto-contrast logic
    useEffect(() => {
      let interval: NodeJS.Timeout;
      if (isAutoContrast) {
        const ms = autoContrastPeriod * 1000;
        interval = setInterval(() => {
          setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
        }, ms);
      }
      return () => clearInterval(interval);
    }, [isAutoContrast, autoContrastPeriod]);

    const isDark = theme === 'dark';

    return (
      <div className={cn('relative h-full w-full overflow-hidden', className)}>
        {/* Controls Toolbar */}
        <div className="absolute top-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90">
          <div className="mr-2 border-r border-zinc-200 pr-2 dark:border-zinc-700">
            <ColorInput
              value={backgroundColor}
              onChange={setBackgroundColor}
              allowTransparent
              onClear={() => setBackgroundColor(null)}
              size="sm"
            />
          </div>

          <button
            onClick={() => {
              setIsAutoContrast(false);
              setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
            }}
            className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Переключить тему (Светлая/Темная)"
          >
            {isDark ? '🌙' : '☀️'}
          </button>

          <button
            onClick={() => setIsAutoContrast(!isAutoContrast)}
            className={cn(
              'rounded-full p-2 transition-colors',
              isAutoContrast
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                : 'text-zinc-500 hover:bg-zinc-100'
            )}
            title="Авто-контраст (Мигание темы)"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>

          {isAutoContrast && (
            <div className="animate-fade-in mx-1 flex items-center gap-2">
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={autoContrastPeriod}
                onChange={(e) => setAutoContrastPeriod(Number(e.target.value))}
                className="h-1 w-16 cursor-pointer appearance-none rounded-lg bg-zinc-200 accent-blue-600 dark:bg-zinc-700"
              />
              <span className="w-5 font-mono text-xs font-bold text-zinc-600 dark:text-zinc-300">
                {autoContrastPeriod}s
              </span>
            </div>
          )}

          <div className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-700" />

          {/* Zoom Label обновляется напрямую из Canvas для производительности */}
          <span
            ref={zoomLabelRef}
            className="min-w-[3ch] px-1 text-right font-mono text-xs text-zinc-500 select-none dark:text-zinc-400"
          >
            {(initialScale || 1 * 100).toFixed(0)}%
          </span>

          <button
            onClick={handleResetView}
            className="rounded px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Сброс
          </button>
        </div>

        {/* Primitive Canvas */}
        <Canvas
          ref={canvasRef}
          zoomLabelRef={zoomLabelRef}
          theme={theme}
          backgroundColor={backgroundColor}
          contentWidth={contentWidth}
          contentHeight={contentHeight}
          shadowOverlayOpacity={shadowOverlayOpacity}
          showTransparencyGrid={showTransparencyGrid}
          placeholder={placeholder}
          minScale={minScale}
          maxScale={maxScale}
          initialScale={initialScale}
        >
          {children}
        </Canvas>

        {/* Overlays */}
        <ProcessingOverlay isVisible={isLoading} />

        <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded bg-white/50 px-2 py-1 text-[10px] text-zinc-500 opacity-50 backdrop-blur-sm dark:bg-black/50">
          Средняя кнопка мыши для перемещения
        </div>
      </div>
    );
  }
);

WorkbenchCanvas.displayName = 'WorkbenchCanvas';
