'use client';

import { useEffect, useRef, useState } from 'react';

import { Icon } from '@/ui/primitive/Icon';

interface RangeVideoPlayerProps {
  src: string | null;
  startTime: number;
  endTime: number;
  className?: string;
}

export function RangeVideoPlayer({
  src,
  startTime,
  endTime,
  className = '',
}: RangeVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);

  const animationFrameRef = useRef<number>(0);

  // Sync Start Logic
  // Если время плеера сильно отличается от startTime при остановленном видео, синхронизируем
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - startTime) > 0.1) {
      if (!isPlaying) {
        videoRef.current.currentTime = startTime;
      }
    }
  }, [startTime, isPlaying]);

  // Playback Loop Logic
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const loop = () => {
      if (!isPlaying) return;

      const t = video.currentTime;
      setCurrentTime(t);

      // Проверка окончания диапазона
      if (t >= endTime) {
        video.currentTime = startTime;
      }

      // Если видео на паузе (из-за внешних факторов), но мы в режиме play - запускаем
      if (video.paused && isPlaying) {
        video.play().catch(() => {
          // Игнорируем ошибки автовоспроизведения
        });
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      video.play().catch(console.error);
      animationFrameRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(animationFrameRef.current);
      video.pause();
    }

    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isPlaying, startTime, endTime]);

  const togglePlay = () => {
    if (!videoRef.current) return;

    // Если мы уже в конце диапазона и нажимаем Play, прыгаем в начало
    if (!isPlaying && videoRef.current.currentTime >= endTime) {
      videoRef.current.currentTime = startTime;
    }

    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newTime = startTime + (endTime - startTime) * pct;

    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    setCurrentTime(newTime);
  };

  if (!src) return null;

  const displayTime = isPlaying ? currentTime : startTime;
  const progress = Math.max(
    0,
    Math.min(100, ((displayTime - startTime) / (endTime - startTime)) * 100)
  );

  return (
    <div className={`group relative bg-black ${className}`}>
      <video
        ref={videoRef}
        src={src}
        className="h-full w-full cursor-pointer object-contain"
        muted
        playsInline
        onClick={togglePlay}
      />

      {/* Play Icon Overlay */}
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
      >
        <div className="rounded-full bg-black/50 p-3 text-white backdrop-blur-sm">
          {isPlaying ? (
            <Icon.Pause className="h-6 w-6" />
          ) : (
            <Icon.Play className="h-6 w-6 translate-x-0.5" />
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="absolute right-0 bottom-0 left-0 flex items-center gap-2 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
        <div
          className="relative h-2 flex-1 cursor-pointer overflow-hidden rounded-full bg-white/20"
          onClick={handleSeek}
        >
          <div className="absolute h-full bg-blue-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="min-w-[60px] text-right font-mono text-[10px] text-white">
          {(currentTime - startTime).toFixed(1)}s
        </div>
      </div>
    </div>
  );
}
