import type React from 'react';
import { useEffect, useState } from 'react';

interface UseVideoScrubberProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  duration: number | null;
  startTime: number;
  endTime: number;
}

export function useVideoScrubber({
  videoRef,
  duration,
  startTime,
  endTime,
}: UseVideoScrubberProps) {
  const [hoverPreview, setHoverPreview] = useState<{ activeThumb: 0 | 1; time: number } | null>(
    null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);

  // 1. Абсорбируем логику отслеживания загрузки
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onSeeking = () => setIsSeeking(true);
    const onSeeked = () => setIsSeeking(false);

    video.addEventListener('seeking', onSeeking);
    video.addEventListener('seeked', onSeeked);

    return () => {
      video.removeEventListener('seeking', onSeeking);
      video.removeEventListener('seeked', onSeeked);
    };
  }, [videoRef]);

  // 2. Абсорбируем математику расчета времени
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || isDragging) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // Clamp 0..1
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    const time = percentage * duration;

    // Эвристика: какой ползунок ближе к курсору?
    const distToStart = Math.abs(time - startTime);
    const distToEnd = Math.abs(time - endTime);
    const nearestThumb = distToStart < distToEnd ? 0 : 1;

    setHoverPreview({ activeThumb: nearestThumb, time });

    // Императивное управление видео (скрыто от UI)
    if (videoRef.current) {
      // Небольшая оптимизация: если время почти не изменилось, не дергаем video
      if (Math.abs(videoRef.current.currentTime - time) > 0.05) {
        videoRef.current.currentTime = time;
      }
    }
  };

  const handleMouseLeave = () => {
    if (!isDragging) setHoverPreview(null);
  };

  const handleDragStart = () => setIsDragging(true);

  const handleDragEnd = () => {
    setIsDragging(false);
    setHoverPreview(null);
  };

  // Проксируем изменение значений, обновляя локальный превью
  const updatePreviewOnDrag = (newTime: number, thumbIndex: 0 | 1) => {
    if (isDragging) {
      setHoverPreview({ activeThumb: thumbIndex, time: newTime });
      if (videoRef.current) videoRef.current.currentTime = newTime;
    }
  };

  return {
    hoverPreview,
    isDragging,
    isSeeking,
    handlers: {
      onMouseMove: handleMouseMove,
      onMouseLeave: handleMouseLeave,
      onPointerDown: handleDragStart,
      onPointerUp: handleDragEnd,
      updatePreviewOnDrag,
    },
  };
}
