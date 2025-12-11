import React, { useCallback, useEffect, useRef } from 'react';

export interface ImageSequencePlayerProps {
  images: (string | null)[];
  fps: number;
  onDrawOverlay?: (
    ctx: CanvasRenderingContext2D,
    index: number,
    width: number,
    height: number
  ) => void;
  width?: number;
  height?: number;
  className?: string;
  placeholderColor?: string;
}

export function ImageSequencePlayer({
  images,
  fps,
  onDrawOverlay,
  width,
  height,
  className,
  placeholderColor = '#f4f4f5',
}: ImageSequencePlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | undefined>(undefined);
  const previousTimeRef = useRef<number | undefined>(undefined);
  const indexRef = useRef(0);

  if (indexRef.current >= images.length) {
    indexRef.current = 0;
  }

  const animate = useCallback(
    function animate(time: number) {
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

              const finalizeFrame = () => {
                if (onDrawOverlay) {
                  ctx.save();
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
                }
              } else {
                // Фон
                ctx.fillStyle = placeholderColor;
                ctx.fillRect(0, 0, w, h);

                // Адаптивный размер текста плейсхолдера
                const fontSize = Math.max(16, Math.floor(w * 0.1));
                ctx.fillStyle = '#a1a1aa';
                ctx.font = `bold ${fontSize}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('...', w / 2, h / 2);
                ctx.textAlign = 'start';

                finalizeFrame();
              }
            }
          }
        }
      } else {
        previousTimeRef.current = time;
      }
      requestRef.current = requestAnimationFrame(animate);
    },
    [images, fps, onDrawOverlay, placeholderColor]
  );

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  useEffect(() => {}, [images]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className || 'h-full w-full object-contain'}
    />
  );
}
