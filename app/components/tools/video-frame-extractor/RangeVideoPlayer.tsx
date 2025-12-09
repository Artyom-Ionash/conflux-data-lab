"use client";

import { useEffect, useRef, useState } from "react";

interface RangeVideoPlayerProps {
  src: string | null;
  startTime: number;
  endTime: number;
  symmetricLoop?: boolean;
  className?: string;
}

export function RangeVideoPlayer({
  src,
  startTime,
  endTime,
  symmetricLoop = false,
  className = ""
}: RangeVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);

  const directionRef = useRef<'forward' | 'backward'>('forward');
  const animationFrameRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // Sync Start
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - startTime) > 0.5) {
      videoRef.current.currentTime = startTime;
      setCurrentTime(startTime);
      directionRef.current = 'forward';
    }
  }, [startTime]);

  // Fix: Reset direction if range changes while moving backward
  useEffect(() => {
    if (directionRef.current === 'backward') {
      directionRef.current = 'forward';
      if (isPlaying && videoRef.current) videoRef.current.play().catch(() => { });
    }
  }, [endTime, isPlaying]);

  // Playback Loop
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const loop = (timestamp: number) => {
      if (!isPlaying) return;

      if (!lastFrameTimeRef.current) lastFrameTimeRef.current = timestamp;
      const dt = (timestamp - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = timestamp;

      const t = video.currentTime;
      setCurrentTime(t);

      if (directionRef.current === 'forward') {
        if (video.paused && isPlaying) video.play().catch(() => { });

        if (t >= endTime) {
          if (symmetricLoop) {
            directionRef.current = 'backward';
            video.pause();
          } else {
            video.currentTime = startTime;
          }
        }
      } else {
        if (!video.paused) video.pause();
        video.currentTime = Math.max(startTime, t - dt); // Manual backward seek

        if (video.currentTime <= startTime) {
          directionRef.current = 'forward';
          video.play().catch(() => { });
        }
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      lastFrameTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(animationFrameRef.current);
      video.pause();
    }
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [isPlaying, startTime, endTime, symmetricLoop]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (!isPlaying && !symmetricLoop && videoRef.current.currentTime >= endTime) {
      videoRef.current.currentTime = startTime;
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const newTime = startTime + (endTime - startTime) * pct;
    if (videoRef.current) videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    directionRef.current = 'forward';
  };

  if (!src) return null;

  const progress = Math.max(0, Math.min(100, ((currentTime - startTime) / (endTime - startTime)) * 100));

  return (
    <div className={`relative bg-black group ${className}`}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain cursor-pointer"
        muted
        playsInline
        onClick={togglePlay}
      />

      {/* Play Icon Overlay */}
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
        <div className="bg-black/50 text-white p-3 rounded-full backdrop-blur-sm">
          {isPlaying ? (
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          ) : (
            <svg className="w-6 h-6 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex gap-2 items-center">
        <div className="flex-1 h-2 bg-white/20 rounded-full cursor-pointer relative overflow-hidden" onClick={handleSeek}>
          <div className="absolute h-full bg-blue-500" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-[10px] text-white font-mono min-w-[60px] text-right">
          {(currentTime - startTime).toFixed(1)}s
        </div>
      </div>
    </div>
  );
}