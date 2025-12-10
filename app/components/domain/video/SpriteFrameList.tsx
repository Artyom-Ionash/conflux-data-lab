import Image from "next/image"; // 1. Импортируем компонент
import React, { useMemo } from "react";

// Определяем интерфейс локально
interface FrameData {
  time: number;
  dataUrl: string | null;
}

interface SpriteFrameListProps {
  frames: FrameData[];
  maxHeight: number;
  spacing: number;
  backgroundColor: string;
  videoAspectRatio: number;
}

const TIMESTAMP_CLASS = "absolute bottom-2 left-2 pointer-events-none bg-black/80 text-white px-2 py-0.5 rounded text-[11px] font-bold font-mono shadow-sm backdrop-blur-[1px]";
const TRANSPARENT_BG_PATTERN = "url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAKQCAYAAAB2440yAAAAIklEQVQ4jWNgGAWjYBQMBAAABgAB/6Zj+QAAAABJRU5ErkJggg==')";

export function SpriteFrameList({
  frames,
  maxHeight,
  spacing,
  backgroundColor,
  videoAspectRatio
}: SpriteFrameListProps) {

  // Вычисляем ширину для пропорционального отображения
  const frameWidth = useMemo(() => {
    return Math.floor(maxHeight * (videoAspectRatio || 1.77));
  }, [maxHeight, videoAspectRatio]);

  if (frames.length === 0) {
    return <div className="text-center text-zinc-400 py-8">Нет кадров</div>;
  }

  const isTransparent = backgroundColor === "transparent";

  return (
    <div
      className={`flex items-start border border-dashed border-zinc-300 dark:border-zinc-700 ${isTransparent ? 'bg-repeat' : ''}`}
      style={{
        backgroundColor: isTransparent ? undefined : backgroundColor,
        backgroundImage: isTransparent ? TRANSPARENT_BG_PATTERN : undefined,
        gap: spacing
      }}
    >
      {frames.map((frame, idx) => (
        <div key={idx} className="relative shrink-0 group">
          {frame.dataUrl ? (
            // 2. Используем Image вместо img
            <Image
              src={frame.dataUrl}
              alt={`frame-${idx}`}
              width={frameWidth}
              height={maxHeight}
              unoptimized // Важно для Data URL (отключает серверную обработку)
              className="shadow-sm rounded-sm object-contain"
              style={{ height: maxHeight, width: frameWidth }} // Явно задаем размеры стилями для надежности
            />
          ) : (
            <div
              className="animate-pulse bg-black/5 rounded-sm"
              style={{ height: maxHeight, width: frameWidth }}
            />
          )}

          <div className={TIMESTAMP_CLASS}>
            {frame.time.toFixed(2)}s
          </div>

          <div className="absolute top-2 right-2 bg-black/60 text-white px-1.5 py-0.5 rounded text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            #{idx + 1}
          </div>
        </div>
      ))}
    </div>
  );
}