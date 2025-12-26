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
import type { CanvasRef } from '@/ui/canvas/Canvas';
import { Canvas } from '@/ui/canvas/Canvas';
import { Toolbar, ToolbarSeparator } from '@/ui/container/Toolbar';
import { ProcessingOverlay } from '@/ui/feedback/ProcessingOverlay';
import { ColorInput } from '@/ui/input/ColorInput';
import { Icon } from '@/ui/primitive/Icon';
import { OverlayLabel } from '@/ui/primitive/OverlayLabel';

const ANIMATION_CONFIG = {
  AUTO_CONTRAST_PERIOD_DEFAULT: 5,
};

interface WorkbenchFrameProps {
  children: ReactNode;
  isLoading?: boolean | undefined;
  contentWidth?: number | undefined;
  contentHeight?: number | undefined;
  shadowOverlayOpacity?: number | undefined;
  showTransparencyGrid?: boolean | undefined;
  defaultBackgroundColor?: string | undefined;
  className?: string | undefined;
  minScale?: number | undefined;
  maxScale?: number | undefined;
  initialScale?: number | undefined;
}

export const WorkbenchFrame = forwardRef<CanvasRef, WorkbenchFrameProps>(
  (
    {
      children,
      isLoading = false,
      contentWidth,
      contentHeight,
      shadowOverlayOpacity,
      showTransparencyGrid,
      defaultBackgroundColor,
      className,
      minScale,
      maxScale,
      initialScale,
    },
    ref
  ) => {
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');
    const [isAutoContrast, setIsAutoContrast] = useState(false);
    const [autoContrastPeriod, setAutoContrastPeriod] = useState(
      ANIMATION_CONFIG.AUTO_CONTRAST_PERIOD_DEFAULT
    );

    const [backgroundColor, setBackgroundColor] = useState<string | null>(
      defaultBackgroundColor || null
    );

    // "State Update During Render" вместо useEffect:
    // позволяет обновить локальный стейт при изменении пропса БЕЗ каскадного рендера эффектов.
    const [prevDefaultColor, setPrevDefaultColor] = useState(defaultBackgroundColor);

    if (defaultBackgroundColor !== undefined && defaultBackgroundColor !== prevDefaultColor) {
      setPrevDefaultColor(defaultBackgroundColor);
      setBackgroundColor(defaultBackgroundColor);
    }

    const canvasRef = useRef<CanvasRef>(null);
    const zoomLabelRef = useRef<HTMLSpanElement>(null);

    useImperativeHandle(ref, () => ({
      resetView: (w, h) => canvasRef.current?.resetView(w, h),
      getTransform: () => canvasRef.current?.getTransform() || { scale: 1, x: 0, y: 0 },
      screenToWorld: (x, y) => canvasRef.current?.screenToWorld(x, y) || { x: 0, y: 0 },
      getBackgroundColor: () => backgroundColor,
    }));

    const handleResetView = useCallback(() => {
      canvasRef.current?.resetView();
    }, []);

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
        <Toolbar>
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
            <Icon.AutoContrast className="h-4 w-4" />
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

          <ToolbarSeparator />

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
            Сбросить
          </button>
        </Toolbar>

        <Canvas
          ref={canvasRef}
          zoomLabelRef={zoomLabelRef}
          theme={theme}
          backgroundColor={backgroundColor}
          contentWidth={contentWidth}
          contentHeight={contentHeight}
          shadowOverlayOpacity={shadowOverlayOpacity}
          showTransparencyGrid={showTransparencyGrid}
          minScale={minScale}
          maxScale={maxScale}
          initialScale={initialScale}
        >
          {children}
        </Canvas>

        <ProcessingOverlay isVisible={isLoading} />

        <OverlayLabel position="bottom-center" className="opacity-50">
          Средняя кнопка мыши для перемещения
        </OverlayLabel>
      </div>
    );
  }
);

WorkbenchFrame.displayName = 'WorkbenchFrame';
