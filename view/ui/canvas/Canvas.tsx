'use client';

import type { ReactNode, RefObject } from 'react';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import { cn, TRANSPARENCY_PATTERN_CSS } from '@/view/ui/infrastructure/standards';
import { useElementSize } from '@/view/ui/infrastructure/use-element-size';

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

// Фоновая сетка самого Canvas (бесконечное поле)
const GRID_CSS_PATTERN = `linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%)`;

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
  // Backward compatibility signatures
  getBackgroundColor: () => string | null;
  setBackgroundColor: (color: string | null) => void;
}

interface CanvasProps {
  children: ReactNode;
  /**
   * Ref для обновления текстовой метки масштаба (например, "100%").
   * Используется для обновления UI без ре-рендеринга родителя.
   */
  zoomLabelRef?: RefObject<HTMLSpanElement | null> | undefined;
  theme?: 'light' | 'dark' | undefined;
  backgroundColor?: string | null | undefined;
  className?: string | undefined;
  minScale?: number | undefined;
  maxScale?: number | undefined;
  initialScale?: number | undefined;
  contentWidth?: number | undefined;
  contentHeight?: number | undefined;
  shadowOverlayOpacity?: number | undefined;
  showTransparencyGrid?: boolean | undefined;
  placeholder?: ReactNode | undefined;
}

// --- MAIN COMPONENT: Canvas ---

export const Canvas = forwardRef<CanvasRef, CanvasProps>(
  (
    {
      children,
      zoomLabelRef,
      theme = 'dark',
      backgroundColor = null,
      className = '',
      minScale = ZOOM_CONFIG.MIN,
      maxScale = ZOOM_CONFIG.MAX,
      initialScale = ZOOM_CONFIG.INITIAL,
      contentWidth,
      contentHeight,
      shadowOverlayOpacity = 0,
      showTransparencyGrid = false,
      placeholder,
    },
    ref
  ) => {
    // 1. Инициализация хука размеров
    const [resizeRef, containerSize] = useElementSize<HTMLDivElement>();

    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // 2. Объединение рефов
    const setRefs = useCallback(
      (node: HTMLDivElement | null) => {
        containerRef.current = node;
        resizeRef(node);
      },
      [resizeRef]
    );

    const transform = useRef<CanvasTransform>({ scale: initialScale ?? 1, x: 0, y: 0 });
    const interactionTimer = useRef<NodeJS.Timeout | null>(null);
    const rafId = useRef<number | null>(null);

    const [isPanning, setIsPanning] = useState(false);

    const panStartRef = useRef<Point | null>(null);
    const transformStartRef = useRef<CanvasTransform | null>(null);

    const updateDOM = useCallback(
      (isInteracting: boolean) => {
        if (!contentRef.current) return;
        const { x, y, scale } = transform.current;

        contentRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;

        if (isInteracting) {
          contentRef.current.style.willChange = 'transform';
        } else {
          contentRef.current.style.willChange = 'auto';
          const renderingMode =
            scale > (ZOOM_CONFIG.PIXELATED_THRESHOLD ?? 4) ? 'pixelated' : 'auto';
          if (contentRef.current.style.imageRendering !== renderingMode) {
            contentRef.current.style.imageRendering = renderingMode;
          }
        }

        // Direct DOM update for performance
        if (zoomLabelRef?.current) {
          zoomLabelRef.current.innerText = `${Math.round(scale * 100)}%`;
        }
      },
      [zoomLabelRef]
    );

    const stabilizeView = useCallback(() => {
      if (!contentRef.current) return;
      updateDOM(false);
      // Trigger reflow to apply rendering changes
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
        const { width: clientWidth, height: clientHeight } = containerSize;
        if (clientWidth === 0 || clientHeight === 0) return;

        const targetW = w || contentWidth || 0;
        const targetH = h || contentHeight || 0;
        let newScale = 1;
        let newX = 0;
        let newY = 0;

        if (targetW && targetH) {
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
      getBackgroundColor: () => backgroundColor,
      setBackgroundColor: () => {
        console.warn('Canvas: setBackgroundColor is deprecated. Use props instead.');
      },
    }));

    const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = Math.max(
        -ZOOM_CONFIG.WHEEL_DELTA_LIMIT,
        Math.min(ZOOM_CONFIG.WHEEL_DELTA_LIMIT, e.deltaY)
      );

      const factor = Math.exp(-delta * ZOOM_CONFIG.INTENSITY);
      const current = transform.current;
      let newScale = current.scale * factor;

      const mnScale = minScale ?? ZOOM_CONFIG.MIN;
      const mxScale = maxScale ?? ZOOM_CONFIG.MAX;

      newScale = Math.max(mnScale, Math.min(newScale, mxScale));

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

    const currentTheme = theme === 'dark' ? THEME_COLORS.DARK : THEME_COLORS.LIGHT;
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
          transitionDuration: `${ANIMATION_CONFIG.DEFAULT_DURATION}ms`,
        }}
      >
        <div
          className={cn(
            'pointer-events-none absolute inset-0 transition-opacity ease-in-out',
            currentTheme.GRID_OPACITY
          )}
          style={{
            transitionDuration: `${ANIMATION_CONFIG.DEFAULT_DURATION}ms`,
            backgroundImage: GRID_CSS_PATTERN,
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            zIndex: 0,
          }}
        />

        <div
          ref={contentRef}
          className="absolute top-0 left-0 z-10 origin-top-left"
          style={{
            transform: `translate3d(${initialScale ?? 1}px, 0px, 0) scale(${initialScale ?? 1})`,
            backfaceVisibility: 'hidden',
          }}
        >
          {hasDimensions && (shadowOverlayOpacity ?? 0) > 0 && (
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
                  // ИСПОЛЬЗУЕМ ОБЩИЙ СТАНДАРТ
                  backgroundImage: TRANSPARENCY_PATTERN_CSS(currentTheme.CHECKER),
                  backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
                  backgroundPosition: `0 0, 0 ${GRID_SIZE / 2}px, ${GRID_SIZE / 2}px -${GRID_SIZE / 2}px, -${GRID_SIZE / 2}px 0px`,
                  backgroundColor: currentTheme.CHECKER_BG,
                }}
              />
            )}

            {hasDimensions && backgroundColor && (
              <div className="absolute inset-0 z-0" style={{ backgroundColor }} />
            )}

            <div className="relative z-10 h-full w-full">{children}</div>
          </div>
        </div>

        {placeholder && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="pointer-events-auto h-full w-full">{placeholder}</div>
          </div>
        )}
      </div>
    );
  }
);

Canvas.displayName = 'Canvas';

export interface CanvasMovableProps {
  x: number;
  y: number;
  /** Текущий масштаб. Можно передать функцию для получения актуального значения без ре-рендера. */
  scale: number | (() => number);
  onMove: (newPos: Point) => void;
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

      // Получаем актуальный масштаб динамически
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

// --- HOOKS ---

/**
 * Хук для управления ссылкой на Canvas.
 * Предоставляет стабильный геттер масштаба для передачи в CanvasMovable
 * и другие интерактивные элементы.
 *
 * @example
 * const { ref, getScale } = useCanvasRef();
 * <Canvas ref={ref} />
 * <CanvasMovable scale={getScale} />
 */
export function useCanvasRef() {
  const ref = useRef<CanvasRef>(null);

  /**
   * Возвращает текущий масштаб холста.
   * Безопасно обрабатывает отсутствие рефа (возвращает 1).
   */
  const getScale = useCallback(() => {
    return ref.current?.getTransform().scale ?? 1;
  }, []);

  /**
   * Сброс вида к дефолтному состоянию.
   */
  const resetView = useCallback((width?: number, height?: number) => {
    ref.current?.resetView(width, height);
  }, []);

  return {
    ref,
    getScale,
    resetView,
    get current() {
      return ref.current;
    },
  };
}
