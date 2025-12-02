"use client";

import { useEffect, useRef, useState } from "react";

interface RangeVideoPlayerProps {
  src: string | null;
  startTime: number;
  endTime: number;
}

export function RangeVideoPlayer({ src, startTime, endTime }: RangeVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);

  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - startTime) > 0.5) {
      videoRef.current.currentTime = startTime;
      setCurrentTime(startTime);
    }
  }, [startTime]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      setCurrentTime(time);

      if (time >= endTime) {
        video.currentTime = startTime;
        if (isPlaying) video.play().catch(() => { });
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [endTime, startTime, isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      if (videoRef.current.currentTime >= endTime) {
        videoRef.current.currentTime = startTime;
      }
      videoRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const duration = endTime - startTime;
  const progress = duration > 0 ? ((currentTime - startTime) / duration) * 100 : 0;
  const progressSafe = Math.max(0, Math.min(100, progress));

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const elapsedTime = Math.max(0, currentTime - startTime);
  const remainingTime = Math.max(0, endTime - currentTime);

  if (!src) return null;

  return (
    <div className="space-y-2 mb-4">
      <div className="relative overflow-hidden rounded-md bg-black aspect-video">
        <video
          ref={videoRef}
          src={src}
          className="h-full w-full object-contain"
          muted
          playsInline
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 hover:opacity-100 transition-opacity group">
          <button
            onClick={togglePlay}
            className="rounded-full bg-white/90 p-3 text-black shadow-lg hover:bg-white hover:scale-110 transition-all"
          >
            {isPlaying ? (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
            ) : (
              <svg className="w-6 h-6 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>
        </div>

        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-full bg-black/50 p-3 text-white backdrop-blur-sm">
              <svg className="w-8 h-8 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </div>
          </div>
        )}

        <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm rounded px-2 py-1 text-xs text-white font-mono">
          {formatTime(elapsedTime)} / {formatTime(duration)}
        </div>
      </div>

      <div className="space-y-1">
        <div className="relative h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-blue-600 transition-all duration-100 ease-linear"
            style={{ width: `${progressSafe}%` }}
          />

          <button
            className="absolute inset-0 cursor-pointer"
            onClick={(e) => {
              if (!videoRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percentage = x / rect.width;
              const newTime = startTime + (duration * percentage);
              videoRef.current.currentTime = Math.max(startTime, Math.min(endTime, newTime));
            }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-mono">{formatTime(elapsedTime)}</span>
            <span className="text-zinc-400 dark:text-zinc-600">•</span>
            <span>Позиция: {currentTime.toFixed(2)}s</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Осталось: {formatTime(remainingTime)}</span>
            <span className="text-zinc-400 dark:text-zinc-600">•</span>
            <span className="font-mono">{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}


