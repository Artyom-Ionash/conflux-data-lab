"use client";

import { useEffect, useRef, useState } from "react";

interface RangeVideoPlayerProps {
  src: string | null;
  startTime: number;
  endTime: number;
  className?: string;
}

export function RangeVideoPlayer({ src, startTime, endTime, className = "" }: RangeVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(startTime);
  const [isHovering, setIsHovering] = useState(false);

  // Sync start time
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - startTime) > 0.5) {
      videoRef.current.currentTime = startTime;
      setCurrentTime(startTime);
    }
  }, [startTime]);

  // Loop logic & Time update
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

  if (!src) return null;

  return (
    <div
      className={`relative bg-black group overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain"
        muted
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
      />

      {/* Center Play Button Overlay */}
      <div
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-200 ${isPlaying && !isHovering ? 'opacity-0' : 'opacity-100'}`}
      >
        <button
          onClick={togglePlay}
          className="rounded-full bg-black/40 p-4 text-white backdrop-blur-sm pointer-events-auto hover:bg-black/60 hover:scale-110 transition-all"
        >
          {isPlaying ? (
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
          ) : (
            <svg className="w-8 h-8 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          )}
        </button>
      </div>

      {/* Bottom Controls Overlay (Gradient + Progress) */}
      <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-1 px-2 transition-opacity duration-200 ${!isPlaying || isHovering ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-end gap-2">

          {/* Progress Bar */}
          <div className="relative flex-1 h-1.5 bg-white/30 rounded-full cursor-pointer overflow-hidden mb-1.5 group/progress">
            <div
              className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
              style={{ width: `${progressSafe}%` }}
            />
            {/* Click area */}
            <div
              className="absolute inset-0 w-full h-full z-10"
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

          {/* Time Display */}
          <div className="text-[10px] text-white font-mono mb-1 min-w-[60px] text-right tabular-nums">
            {formatTime(elapsedTime)} / {formatTime(duration)}
          </div>
        </div>
      </div>
    </div>
  );
}