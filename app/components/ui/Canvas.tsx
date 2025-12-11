'use client';

import React, {
  forwardRef,
  ReactNode,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

// --- CONSTANTS ---
const DEFAULT_SCALE_MIN = 0.05;
const DEFAULT_SCALE_MAX = 50;
const DEFAULT_INITIAL_SCALE = 1;
const ZOOM_INTENSITY = 0.002;
const PAN_BUTTON_CODE = 1; // Middle mouse button
const STABILIZATION_DELAY = 150; // ms
const AUTO_CONTRAST_PERIOD_DEFAULT = 5; // seconds
const OVERLAY_SPREAD_SIZE = 50_000;

const THEME_DARK_BG = 'bg-[#111]';
const THEME_LIGHT_BG = 'bg-[#e5e5e5]';
const GRID_OPACITY_DARK = 'opacity-10';
const GRID_OPACITY_LIGHT = 'opacity-30';
const GRID_PATTERN =
  'linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%)';

const CHECKER_COLOR_DARK = '#333';
const CHECKER_COLOR_LIGHT = '#ccc';
const CHECKER_BG_DARK = '#111';
const CHECKER_BG_LIGHT = '#fff';

interface Point {
  x: number;
  y: number;
}

export interface CanvasTransform {
  scale: number;
  x: number;
  y: number;
}

export interface CanvasRef {
  resetView: (width?: number, height?: number) => void;
  getTransform: () => CanvasTransform;
  screenToWorld: (clientX: number, clientY: number) => Point;
  getBackgroundColor: () => string | null;
  setBackgroundColor: (color: string | null) => void;
}

interface CanvasProps {
  children: ReactNode;
  isLoading?: boolean;
  className?: string;
  minScale?: number;
  maxScale?: number;
  initialScale?: number;
  contentWidth?: number;
  contentHeight?: number;
  theme?: 'light' | 'dark';
  shadowOverlayOpacity?: number;
  showTransparencyGrid?: boolean;
  defaultBackgroundColor?: string;
  placeholder?: ReactNode;
}

export const Canvas = forwardRef<CanvasRef, CanvasProps>(
  (
    {
      children,
      isLoading = false,
      className = '',
      minScale = DEFAULT_SCALE_MIN,
      maxScale = DEFAULT_SCALE_MAX,
      initialScale = DEFAULT_INITIAL_SCALE,
      contentWidth,
      contentHeight,
      theme: propTheme,
      shadowOverlayOpacity = 0,
      showTransparencyGrid = false,
      defaultBackgroundColor = null,
      placeholder,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const zoomLabelRef = useRef<HTMLSpanElement>(null);

    const transform = useRef<CanvasTransform>({ scale: initialScale, x: 0, y: 0 });
    const interactionTimer = useRef<NodeJS.Timeout | null>(null);
    const rafId = useRef<number | null>(null);

    const [isPanning, setIsPanning] = useState(false);
    const [internalTheme, setInternalTheme] = useState<'light' | 'dark'>('dark');
    const [isAutoContrast, setIsAutoContrast] = useState(false);
    const [autoContrastPeriod, setAutoContrastPeriod] = useState(AUTO_CONTRAST_PERIOD_DEFAULT);

    // null означает "прозрачный", string - HEX цвет
    const [canvasBgColor, setCanvasBgColor] = useState<string | null>(defaultBackgroundColor);
    // Храним последний выбранный цвет для инпута, чтобы он не сбрасывался в черный при выборе прозрачности
    const [pickerValue, setPickerValue] = useState<string>(defaultBackgroundColor || '#ffffff');

    const activeTheme = propTheme || internalTheme;
    const panStartRef = useRef<Point | null>(null);
    const transformStartRef = useRef<CanvasTransform | null>(null);

    const updateDOM = useCallback((isInteracting: boolean) => {
      if (!contentRef.current) return;
      const { x, y, scale } = transform.current;

      contentRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;

      if (isInteracting) {
        contentRef.current.style.willChange = 'transform';
      } else {
        contentRef.current.style.willChange = 'auto';
        const renderingMode = scale > 4 ? 'pixelated' : 'auto';
        if (contentRef.current.style.imageRendering !== renderingMode) {
          contentRef.current.style.imageRendering = renderingMode;
        }
      }

      if (zoomLabelRef.current) {
        zoomLabelRef.current.innerText = `${Math.round(scale * 100)}%`;
      }
    }, []);

    const stabilizeView = useCallback(() => {
      if (!contentRef.current) return;
      updateDOM(false);
      /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
      const _force = contentRef.current.offsetHeight;
    }, [updateDOM]);

    const scheduleUpdate = useCallback(
      (interacting: boolean) => {
        if (rafId.current) cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(() => {
          updateDOM(interacting);
        });
        if (interactionTimer.current) clearTimeout(interactionTimer.current);
        if (interacting) {
          interactionTimer.current = setTimeout(() => {
            stabilizeView();
            rafId.current = null;
          }, STABILIZATION_DELAY);
        }
      },
      [updateDOM, stabilizeView]
    );

    useLayoutEffect(() => {
      updateDOM(false);
    }, [updateDOM]);

    const performResetView = useCallback(
      (w?: number, h?: number) => {
        if (!containerRef.current) return;
        const { clientWidth, clientHeight } = containerRef.current;
        const targetW = w || contentWidth || 0;
        const targetH = h || contentHeight || 0;
        let newScale = 1;
        let newX = 0;
        let newY = 0;

        if (targetW && targetH) {
          const padding = 40;
          const scaleX = (clientWidth - padding) / targetW;
          const scaleY = (clientHeight - padding) / targetH;
          newScale = Math.min(1, Math.min(scaleX, scaleY));
          if (newScale <= 0) newScale = 1;
          newX = (clientWidth - targetW * newScale) / 2;
          newY = (clientHeight - targetH * newScale) / 2;
        } else {
          newX = clientWidth / 2;
          newY = clientHeight / 2;
        }

        transform.current = { scale: newScale, x: newX, y: newY };
        scheduleUpdate(false);
      },
      [contentWidth, contentHeight, scheduleUpdate]
    );

    useImperativeHandle(ref, () => ({
      resetView: (w, h) => performResetView(w, h),
      getTransform: () => transform.current,
      screenToWorld: (clientX: number, clientY: number) => {
        if (!containerRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const { x, y, scale } = transform.current;
        const worldX = (clientX - rect.left - x) / scale;
        const worldY = (clientY - rect.top - y) / scale;
        return { x: worldX, y: worldY };
      },
      getBackgroundColor: () => canvasBgColor,
      setBackgroundColor: (color: string | null) => {
        setCanvasBgColor(color);
        if (color) setPickerValue(color);
      },
    }));

    useEffect(() => {
      let interval: NodeJS.Timeout;
      if (isAutoContrast) {
        const ms = autoContrastPeriod * 1000;
        interval = setInterval(() => {
          setInternalTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
        }, ms);
      }
      return () => clearInterval(interval);
    }, [isAutoContrast, autoContrastPeriod]);

    const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = Math.max(-100, Math.min(100, e.deltaY));
      const factor = Math.exp(-delta * ZOOM_INTENSITY);
      const current = transform.current;
      let newScale = current.scale * factor;
      newScale = Math.max(minScale, Math.min(newScale, maxScale));
      const scaleRatio = newScale / current.scale;
      const newX = mouseX - (mouseX - current.x) * scaleRatio;
      const newY = mouseY - (mouseY - current.y) * scaleRatio;
      transform.current = { scale: newScale, x: newX, y: newY };
      scheduleUpdate(true);
    };

    const handlePointerDown = (e: React.PointerEvent) => {
      if (e.button === PAN_BUTTON_CODE) {
        e.preventDefault();
        if (containerRef.current) containerRef.current.setPointerCapture(e.pointerId);
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
        transformStartRef.current = { ...transform.current };
        scheduleUpdate(true);
      }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (isPanning && panStartRef.current && transformStartRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        transform.current.x = transformStartRef.current.x + dx;
        transform.current.y = transformStartRef.current.y + dy;
        scheduleUpdate(true);
      }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      if (e.button === PAN_BUTTON_CODE && isPanning) {
        setIsPanning(false);
        panStartRef.current = null;
        transformStartRef.current = null;
        scheduleUpdate(true);
      }
    };

    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setPickerValue(val);
      setCanvasBgColor(val);
    };

    const isDark = activeTheme === 'dark';
    const bgClass = isDark ? THEME_DARK_BG : THEME_LIGHT_BG;
    const gridOpacity = isDark ? GRID_OPACITY_DARK : GRID_OPACITY_LIGHT;
    const transitionDuration = isAutoContrast ? autoContrastPeriod * 1000 * 0.9 : 300;
    const checkerColor = isDark ? CHECKER_COLOR_DARK : CHECKER_COLOR_LIGHT;
    const checkerBg = isDark ? CHECKER_BG_DARK : CHECKER_BG_LIGHT;
    const hasDimensions = !!contentWidth && !!contentHeight;

    return (
      <div
        ref={containerRef}
        className={`relative h-full w-full touch-none overflow-hidden transition-colors ease-in-out select-none ${bgClass} ${className}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          cursor: isPanning ? 'grabbing' : 'default',
          transitionDuration: `${transitionDuration}ms`,
        }}
      >
        <div className="absolute top-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90">
          {/* Блок выбора цвета */}
          <div
            className="mr-2 flex items-center gap-1.5 border-r border-zinc-200 pr-2 dark:border-zinc-700"
            title="Цвет фона (стандартный инпут не поддерживает прозрачность)"
          >
            <div className="group relative h-6 w-6 cursor-pointer overflow-hidden rounded-full border border-zinc-300 shadow-sm transition-transform hover:scale-105 dark:border-zinc-600">
              {/* Нативный инпут поверх всего, но полностью невидимый */}
              <input
                type="color"
                className="absolute inset-0 z-10 m-0 h-[150%] w-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer p-0 opacity-0"
                value={pickerValue}
                onInput={handleColorChange}
              />

              {/* Визуальное отображение "под" инпутом */}
              <div
                className="absolute inset-0 z-0 bg-white"
                style={{
                  backgroundImage: `linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)`,
                  backgroundSize: '8px 8px',
                  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
                }}
              />

              {/* Слой цвета (если выбран) */}
              <div
                className="absolute inset-0 z-1 transition-colors duration-200"
                style={{ backgroundColor: canvasBgColor || 'transparent' }}
              />
            </div>

            {/* Кнопка сброса на прозрачный */}
            {canvasBgColor !== null && (
              <button
                onClick={() => setCanvasBgColor(null)}
                className="flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800"
                title="Сбросить на прозрачный"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            )}
          </div>

          <button
            onClick={() => {
              setIsAutoContrast(false);
              setInternalTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
            }}
            className="rounded-full p-2 text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {isDark ? '🌙' : '☀️'}
          </button>
          <button
            onClick={() => setIsAutoContrast(!isAutoContrast)}
            className={`rounded-full p-2 transition-colors ${isAutoContrast ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'text-zinc-500 hover:bg-zinc-100'}`}
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
          <span
            ref={zoomLabelRef}
            className="min-w-[3ch] px-1 text-right font-mono text-xs text-zinc-500 select-none dark:text-zinc-400"
          >
            {(initialScale * 100).toFixed(0)}%
          </span>
          <button
            onClick={() => performResetView()}
            className="rounded px-2 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Сброс
          </button>
        </div>

        <div
          className={`pointer-events-none absolute inset-0 transition-opacity ease-in-out ${gridOpacity}`}
          style={{
            transitionDuration: `${transitionDuration}ms`,
            backgroundImage: GRID_PATTERN,
            backgroundSize: '20px 20px',
            zIndex: 0,
          }}
        />

        <div
          ref={contentRef}
          className="absolute top-0 left-0 z-10 origin-top-left"
          style={{
            transform: `translate3d(${initialScale}px, 0px, 0) scale(${initialScale})`,
            backfaceVisibility: 'hidden',
          }}
        >
          {hasDimensions && shadowOverlayOpacity > 0 && (
            <div
              className="pointer-events-none absolute top-0 left-0"
              style={{
                width: contentWidth,
                height: contentHeight,
                boxShadow: `0 0 0 ${OVERLAY_SPREAD_SIZE}px rgba(0,0,0,${shadowOverlayOpacity})`,
                zIndex: 0,
              }}
            />
          )}

          <div
            className="relative"
            style={{
              width: hasDimensions ? contentWidth : undefined,
              height: hasDimensions ? contentHeight : undefined,
              overflow: hasDimensions ? 'hidden' : 'visible',
              zIndex: 1,
            }}
          >
            {hasDimensions && showTransparencyGrid && (
              <div
                className="pointer-events-none absolute inset-0 z-0 transition-colors duration-300"
                style={{
                  backgroundImage: `linear-gradient(45deg, ${checkerColor} 25%, transparent 25%), linear-gradient(-45deg, ${checkerColor} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${checkerColor} 75%), linear-gradient(-45deg, transparent 75%, ${checkerColor} 75%)`,
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                  backgroundColor: checkerBg,
                }}
              />
            )}

            {/* Слой заливки цветом (canvasBgColor) */}
            {hasDimensions && canvasBgColor && (
              <div className="absolute inset-0 z-0" style={{ backgroundColor: canvasBgColor }} />
            )}

            <div className="relative z-10 h-full w-full">{children}</div>
          </div>
        </div>

        {placeholder && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="pointer-events-auto h-full w-full">{placeholder}</div>
          </div>
        )}

        {isLoading && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
            <div className="flex flex-col items-center gap-3 rounded-lg bg-white p-4 shadow-xl dark:bg-zinc-900">
              <svg
                className="h-8 w-8 animate-spin text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded bg-white/50 px-2 py-1 text-[10px] text-zinc-500 opacity-50 backdrop-blur-sm dark:bg-black/50">
          Средняя кнопка мыши для перемещения
        </div>
      </div>
    );
  }
);

Canvas.displayName = 'Canvas';
