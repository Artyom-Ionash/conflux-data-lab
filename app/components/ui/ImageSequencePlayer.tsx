import React, { useCallback, useEffect, useRef } from "react";

export interface ImageSequencePlayerProps {
  /**
   * Массив URL изображений.
   * null используется для обозначения отсутствующего/загружаемого кадра.
   */
  images: (string | null)[];

  /** Количество кадров в секунду */
  fps: number;

  /**
   * Функция обратного вызова для отрисовки поверх кадра.
   * Позволяет родительскому компоненту рисовать текст, водяные знаки и т.д.
   */
  onDrawOverlay?: (ctx: CanvasRenderingContext2D, index: number, width: number, height: number) => void;

  width?: number;
  height?: number;
  className?: string;

  /** Цвет фона для пустых (null) кадров */
  placeholderColor?: string;
}

export function ImageSequencePlayer({
  images,
  fps,
  onDrawOverlay,
  width,
  height,
  className,
  placeholderColor = "#f4f4f5" // zinc-100 по умолчанию
}: ImageSequencePlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const indexRef = useRef(0);

  // Сброс индекса, если массив кадров изменился (например, при загрузке нового видео)
  if (indexRef.current >= images.length) {
    indexRef.current = 0;
  }

  const animate = useCallback((time: number) => {
    if (previousTimeRef.current !== undefined) {
      const deltaTime = time - previousTimeRef.current;
      const interval = 1000 / fps;

      if (deltaTime > interval) {
        previousTimeRef.current = time - (deltaTime % interval);

        if (images.length > 0) {
          indexRef.current = (indexRef.current + 1) % images.length;
          const imageUrl = images[indexRef.current];
          const currentIndex = indexRef.current;

          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');

          if (canvas && ctx) {
            const w = canvas.width;
            const h = canvas.height;

            // Вспомогательная функция для финализации кадра (вызов оверлея)
            const finalizeFrame = () => {
              if (onDrawOverlay) {
                ctx.save(); // Сохраняем состояние контекста перед внешним вмешательством
                onDrawOverlay(ctx, currentIndex, w, h);
                ctx.restore();
              }
            };

            if (imageUrl) {
              const img = new Image();
              img.src = imageUrl;

              const drawImage = () => {
                ctx.clearRect(0, 0, w, h);
                ctx.drawImage(img, 0, 0, w, h);
                finalizeFrame();
              };

              if (img.complete) {
                drawImage();
              } else {
                img.onload = drawImage;
                // В реальном проекте здесь можно добавить обработку ошибки загрузки картинки
              }
            } else {
              // Отрисовка плейсхолдера
              ctx.fillStyle = placeholderColor;
              ctx.fillRect(0, 0, w, h);

              // Рисуем троеточие для индикации загрузки/пустоты
              ctx.fillStyle = '#d4d4d8'; // zinc-300
              ctx.font = '10px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('...', w / 2, h / 2);
              ctx.textAlign = 'start'; // сброс

              finalizeFrame();
            }
          }
        }
      }
    } else {
      previousTimeRef.current = time;
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [images, fps, onDrawOverlay, placeholderColor]);

  // Запуск цикла анимации
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // Эффект для отрисовки первого кадра при инициализации (без ожидания тика анимации)
  useEffect(() => {
    // Этот эффект полезен, чтобы канвас не был пустым при первой загрузке или паузе
    // В данном случае animate() и так запустится, но это "страховка" для быстрой отрисовки статики
  }, [images]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className || "w-full h-full object-contain"}
    />
  );
}