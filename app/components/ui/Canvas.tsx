'use client';

import React, { useRef, useState, useImperativeHandle, forwardRef, ReactNode, useEffect, useCallback, useLayoutEffect } from 'react';

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
}

export const Canvas = forwardRef<CanvasRef, CanvasProps>(
  ({
    children,
    isLoading = false,
    className = '',
    minScale = 0.05,
    maxScale = 50,
    initialScale = 1,
    contentWidth,
    contentHeight,
    theme: propTheme,
  }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    // Ref для прямого обновления текста без ре-рендера React
    const zoomLabelRef = useRef<HTMLSpanElement>(null);

    const transform = useRef<CanvasTransform>({ scale: initialScale, x: 0, y: 0 });

    const [isPanning, setIsPanning] = useState(false);
    const [internalTheme, setInternalTheme] = useState<'light' | 'dark'>('dark');
    const [isAutoContrast, setIsAutoContrast] = useState(false);
    const [autoContrastPeriod, setAutoContrastPeriod] = useState(5);

    const activeTheme = propTheme || internalTheme;

    const panStartRef = useRef<Point | null>(null);
    const transformStartRef = useRef<CanvasTransform | null>(null);

    // --- Direct DOM Update ---
    const updateDOM = useCallback(() => {
      // 1. Обновляем трансформацию слоя
      if (contentRef.current) {
        const { x, y, scale } = transform.current;
        contentRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
        contentRef.current.style.setProperty('--canvas-scale', scale.toString());
      }
      // 2. Обновляем текст индикатора масштаба напрямую
      if (zoomLabelRef.current) {
        zoomLabelRef.current.innerText = `${Math.round(transform.current.scale * 100)}%`;
      }
    }, []);

    useLayoutEffect(() => {
      updateDOM();
    }, [updateDOM]);

    // --- Logic: Reset View ---
    const performResetView = useCallback((w?: number, h?: number) => {
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
      updateDOM();
    }, [contentWidth, contentHeight, updateDOM]);

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
      }
    }));

    useEffect(() => {
      let interval: NodeJS.Timeout;
      if (isAutoContrast) {
        const ms = autoContrastPeriod * 1000;
        interval = setInterval(() => {
          setInternalTheme(prev => prev === 'light' ? 'dark' : 'light');
        }, ms);
      }
      return () => clearInterval(interval);
    }, [isAutoContrast, autoContrastPeriod]);

    // --- Event Handlers ---
    const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // ИСПРАВЛЕНИЕ: Используем deltaY для плавного масштабирования
      // Коэффициент 0.002 подобран эмпирически для комфортного зума на тачпадах и мышках
      const zoomIntensity = 0.002;
      const factor = Math.exp(-e.deltaY * zoomIntensity);

      const current = transform.current;
      let newScale = current.scale * factor;
      newScale = Math.max(minScale, Math.min(newScale, maxScale));

      const scaleRatio = newScale / current.scale;
      const newX = mouseX - (mouseX - current.x) * scaleRatio;
      const newY = mouseY - (mouseY - current.y) * scaleRatio;

      transform.current = { scale: newScale, x: newX, y: newY };
      updateDOM();
    };

    const handlePointerDown = (e: React.PointerEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        if (containerRef.current) containerRef.current.setPointerCapture(e.pointerId);
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
        transformStartRef.current = { ...transform.current };
      }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (isPanning && panStartRef.current && transformStartRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;

        transform.current.x = transformStartRef.current.x + dx;
        transform.current.y = transformStartRef.current.y + dy;

        updateDOM();
      }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      if (e.button === 1 && isPanning) {
        setIsPanning(false);
        panStartRef.current = null;
        transformStartRef.current = null;
      }
    };

    const isDark = activeTheme === 'dark';
    const bgClass = isDark ? 'bg-[#111]' : 'bg-[#e5e5e5]';
    const gridOpacity = isDark ? 'opacity-10' : 'opacity-30';
    const transitionDuration = isAutoContrast ? (autoContrastPeriod * 1000) * 0.9 : 300;
    const gridPattern = 'linear-gradient(45deg, #888 25%, transparent 25%), linear-gradient(-45deg, #888 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #888 75%), linear-gradient(-45deg, transparent 75%, #888 75%)';

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full overflow-hidden select-none touch-none transition-colors ease-in-out ${bgClass} ${className}`}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          cursor: isPanning ? 'grabbing' : 'default',
          transitionDuration: `${transitionDuration}ms`
        }}
      >
        {/* === Floating Toolbar === */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur px-3 py-2 rounded-full shadow-lg border border-zinc-200 dark:border-zinc-700">
          <button onClick={() => { setIsAutoContrast(false); setInternalTheme(prev => prev === 'dark' ? 'light' : 'dark'); }} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors" title="Сменить тему фона">
            {isDark ? "🌙" : "☀️"}
          </button>

          <button onClick={() => setIsAutoContrast(!isAutoContrast)} className={`p-2 rounded-full transition-colors ${isAutoContrast ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-zinc-100 text-zinc-500'}`} title="Авто-контраст">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </button>

          {isAutoContrast && (
            <div className="flex items-center gap-2 mx-1 animate-fade-in">
              <input type="range" min="1" max="10" step="1" value={autoContrastPeriod} onChange={e => setAutoContrastPeriod(Number(e.target.value))} className="w-16 h-1 bg-zinc-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-blue-600" />
              <span className="text-xs font-mono font-bold text-zinc-600 dark:text-zinc-300 w-5">{autoContrastPeriod}s</span>
            </div>
          )}

          <div className="w-px h-4 bg-zinc-300 dark:bg-zinc-700 mx-1" />

          {/* Индикатор масштаба */}
          <span
            ref={zoomLabelRef}
            className="text-xs font-mono px-1 min-w-[3ch] text-right text-zinc-500 dark:text-zinc-400 select-none"
          >
            {(initialScale * 100).toFixed(0)}%
          </span>

          <button onClick={() => performResetView()} className="text-xs font-medium px-2 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded transition-colors" title="Сбросить вид">Сброс</button>
        </div>

        {/* === Background Grid === */}
        <div className={`absolute inset-0 pointer-events-none transition-opacity ease-in-out ${gridOpacity}`} style={{ transitionDuration: `${transitionDuration}ms`, backgroundImage: gridPattern, backgroundSize: '20px 20px', zIndex: 0 }} />

        {/* === Transform Layer === */}
        <div
          ref={contentRef}
          className="absolute top-0 left-0 will-change-transform origin-top-left z-10"
        >
          {children}
        </div>

        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-[2px] pointer-events-none">
            <div className="bg-white dark:bg-zinc-900 rounded-lg p-4 shadow-xl flex flex-col items-center gap-3">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">Обработка...</span>
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none opacity-50 text-[10px] text-zinc-500 bg-white/50 dark:bg-black/50 px-2 py-1 rounded backdrop-blur-sm z-50">Средняя кнопка мыши для перемещения</div>
      </div>
    );
  }
);

Canvas.displayName = 'Canvas';