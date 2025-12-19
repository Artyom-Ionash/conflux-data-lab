'use client';

import type { ReactNode } from 'react';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { cn } from '@/view/ui/infrastructure/standards';
import { useElementSize } from '@/view/ui/infrastructure/use-element-size';

// eslint-disable-next-line boundaries/element-types
import { ColorInput } from './ColorInput';
// eslint-disable-next-line boundaries/element-types
import { ProcessingOverlay } from './ProcessingOverlay';

// --- CONFIGURATION CONSTANTS ---

// Zoom & Pan limits
const ZOOM_CONFIG = {
  MIN: 0.05,
  MAX: 50,
  INITIAL: 1,
  INTENSITY: 0.002, // Коэффициент чувствительности колеса мыши
  PIXELATED_THRESHOLD: 4, // Масштаб, после которого включается image-rendering: pixelated
  WHEEL_DELTA_LIMIT: 100, // Ограничение дельты колеса мыши для плавности
};

// Viewport settings
const VIEWPORT_PADDING = 40; // Отступ при автоматическом сбросе вида (fit to screen)

// Animation settings
const ANIMATION_CONFIG = {
  STABILIZATION_DELAY: 150, // ms, задержка перед финальной стабилизацией после зума
  DEFAULT_DURATION: 300, // ms, стандартная анимация переходов
  AUTO_CONTRAST_PERIOD_DEFAULT: 5, // секунд
  AUTO_CONTRAST_TRANSITION_FACTOR: 0.9, // Доля времени анимации от периода смены темы
};

// Mouse interaction
const PAN_BUTTON_CODE = 1; // Middle mouse button (Колесико)

// --- STYLING CONSTANTS ---

const OVERLAY_SPREAD_SIZE = 50_000; // Размер тени для затемнения области вокруг контента
const GRID_SIZE = 20; // Размер клетки фона в пикселях

const THEME_COLORS = {
  DARK: {
    BG: 'bg-[#111]',
    CHECKER: '#333',
    CHECKER_BG: '#111',
    GRID_OPACITY: 'opacity-10',
  },
  LIGHT: {
    BG: 'bg-[#e5e5e5]',
    CHECKER: '#ccc',
    CHECKER_BG: '#fff',
    GRID_OPACITY: 'opacity-30',
  },
} as const;

// CSS Patterns (теперь используют GRID_SIZE)
const GRID_CSS_PATTERN = `linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%)`;

const CHECKER_CSS_TEMPLATE = (color: string) =>
  `linear-gradient(45deg, ${color} 25%, transparent 25%), linear-gradient(-45deg, ${color} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${color} 75%), linear-gradient(-45deg, transparent 75%, ${color} 75%)`;

// --- TYPES ---

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

// --- COMPONENT ---

export const Canvas = forwardRef<CanvasRef, CanvasProps>(
  (
    {
      children,
      isLoading = false,
      className = '',
      minScale = ZOOM_CONFIG.MIN,
      maxScale = ZOOM_CONFIG.MAX,
      initialScale = ZOOM_CONFIG.INITIAL,
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
    // 1. Инициализация хука размеров
    const [resizeRef, containerSize] = useElementSize<HTMLDivElement>();

    // Нам все еще нужен useRef для императивных вызовов (pointerCapture, getBoundingClientRect)
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const zoomLabelRef = useRef<HTMLSpanElement>(null);

    // 2. Объединение рефов
    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        containerRef.current = node;
        resizeRef(node);
      },
      [resizeRef]
    );

    const transform = useRef<CanvasTransform>({ scale: initialScale, x: 0, y: 0 });
    const interactionTimer = useRef<NodeJS.Timeout | null>(null);
    const rafId = useRef<number | null>(null);

    const [isPanning, setIsPanning] = useState(false);
    const [internalTheme, setInternalTheme] = useState<'light' | 'dark'>('dark');
    const [isAutoContrast, setIsAutoContrast] = useState(false);
    const [autoContrastPeriod, setAutoContrastPeriod] = useState(
      ANIMATION_CONFIG.AUTO_CONTRAST_PERIOD_DEFAULT
    );

    const [canvasBgColor, setCanvasBgColor] = useState<string | null>(defaultBackgroundColor);

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
        // Включаем пикселизацию только при большом увеличении
        const renderingMode = scale > ZOOM_CONFIG.PIXELATED_THRESHOLD ? 'pixelated' : 'auto';
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
          }, ANIMATION_CONFIG.STABILIZATION_DELAY);
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

        // 3. Используем реактивные размеры из хука
        const { width: clientWidth, height: clientHeight } = containerSize;

        // Если размеры еще не вычислены (0), выходим
        if (clientWidth === 0 || clientHeight === 0) return;

        const targetW = w || contentWidth || 0;
        const targetH = h || contentHeight || 0;
        let newScale = 1;
        let newX = 0;
        let newY = 0;

        if (targetW && targetH) {
          // Вычисляем масштаб, чтобы контент влез с отступом
          const scaleX = (clientWidth - VIEWPORT_PADDING) / targetW;
          const scaleY = (clientHeight - VIEWPORT_PADDING) / targetH;
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
      [contentWidth, contentHeight, scheduleUpdate, containerSize]
    );

    // 4. Автоматический сброс вида при изменении размеров контейнера
    useEffect(() => {
      if (containerSize.width > 0 && containerSize.height > 0) {
        performResetView();
      }
    }, [containerSize.width, containerSize.height, performResetView]);

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
      // Блокируем скролл страницы даже если контент вылез за пределы (чего быть не должно, но на всякий случай)
      e.preventDefault();
      e.stopPropagation();

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Ограничиваем дельту для плавности на разных мышках/тачпадах
      const delta = Math.max(
        -ZOOM_CONFIG.WHEEL_DELTA_LIMIT,
        Math.min(ZOOM_CONFIG.WHEEL_DELTA_LIMIT, e.deltaY)
      );

      const factor = Math.exp(-delta * ZOOM_CONFIG.INTENSITY);
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

    const isDark = activeTheme === 'dark';
    const currentTheme = isDark ? THEME_COLORS.DARK : THEME_COLORS.LIGHT;

    const transitionDuration = isAutoContrast
      ? autoContrastPeriod * 1000 * ANIMATION_CONFIG.AUTO_CONTRAST_TRANSITION_FACTOR
      : ANIMATION_CONFIG.DEFAULT_DURATION;

    const hasDimensions = !!contentWidth && !!contentHeight;

    return (
      <div
        ref={setRefs}
        className={cn(
          'relative h-full w-full touch-none overflow-hidden overscroll-none transition-colors ease-in-out select-none',
          currentTheme.BG,
          className
        )}
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
        {/* Controls Overlay */}
        <div className="absolute top-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3 py-2 shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90">
          <div className="mr-2 border-r border-zinc-200 pr-2 dark:border-zinc-700">
            <ColorInput
              value={canvasBgColor}
              onChange={(v) => setCanvasBgColor(v)}
              allowTransparent
              onClear={() => setCanvasBgColor(null)}
              size="sm"
            />
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
            className={cn(
              'rounded-full p-2 transition-colors',
              isAutoContrast
                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300'
                : 'text-zinc-500 hover:bg-zinc-100'
            )}
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

        {/* Grid Background */}
        <div
          className={cn(
            'pointer-events-none absolute inset-0 transition-opacity ease-in-out',
            currentTheme.GRID_OPACITY
          )}
          style={{
            transitionDuration: `${transitionDuration}ms`,
            backgroundImage: GRID_CSS_PATTERN,
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            zIndex: 0,
          }}
        />

        {/* Content Transform Container */}
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
                  backgroundImage: CHECKER_CSS_TEMPLATE(currentTheme.CHECKER),
                  backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                  backgroundPosition: `0 0, 0 ${GRID_SIZE / 2}px, ${GRID_SIZE / 2}px -${GRID_SIZE / 2}px, -${GRID_SIZE / 2}px 0px`,
                  backgroundColor: currentTheme.CHECKER_BG,
                }}
              />
            )}

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

        <ProcessingOverlay isVisible={isLoading} />

        <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 rounded bg-white/50 px-2 py-1 text-[10px] text-zinc-500 opacity-50 backdrop-blur-sm dark:bg-black/50">
          Средняя кнопка мыши для перемещения
        </div>
      </div>
    );
  }
);

Canvas.displayName = 'Canvas';
