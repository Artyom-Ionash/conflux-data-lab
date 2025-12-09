"use client";

import { useEffect, useRef, useState } from "react";

interface RangeVideoPlayerProps {
  src: string | null;
  startTime: number;
  endTime: number;
  symmetricLoop?: boolean; // New prop for loop mode
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
  const [isHovering, setIsHovering] = useState(false);

  // Track direction for symmetric loop
  const directionRef = useRef<'forward' | 'backward'>('forward');
  const animationFrameRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);

  // Sync start time when inputs change
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - startTime) > 0.5) {
      videoRef.current.currentTime = startTime;
      setCurrentTime(startTime);
      directionRef.current = 'forward'; // Reset direction on range change
    }
  }, [startTime]);

  // Main playback loop logic
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const loop = (timestamp: number) => {
      if (!isPlaying) return;

      const t = video.currentTime;
      setCurrentTime(t);

      // Delta time calculation for smoother backward playback
      if (!lastFrameTimeRef.current) lastFrameTimeRef.current = timestamp;
      const deltaTime = (timestamp - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = timestamp;

      if (directionRef.current === 'forward') {
        // Native forward playback
        if (video.paused && isPlaying) video.play().catch(() => { });

        if (t >= endTime) {
          if (symmetricLoop) {
            directionRef.current = 'backward';
            video.pause(); // Pause native playback to take control manually
          } else {
            video.currentTime = startTime;
          }
        }
      } else {
        // Manual backward playback
        if (!video.paused) video.pause(); // Ensure native is paused

        // Decrement time manually (simulate 1x speed backwards)
        // Note: Performance depends on video codec (keyframe distance)
        video.currentTime = Math.max(startTime, t - deltaTime);

        if (video.currentTime <= startTime) {
          directionRef.current = 'forward';
          video.play().catch(() => { }); // Resume native playback
        }
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      lastFrameTimeRef.current = performance.now();
      animationFrameRef.current = requestAnimationFrame(loop);
    } else {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      video.pause();
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, startTime, endTime, symmetricLoop]);

  // Simple event listener just for UI updates when paused or seeking manually
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      if (!isPlaying) setCurrentTime(video.currentTime);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => video.removeEventListener("timeupdate", handleTimeUpdate);
  }, [isPlaying]);

  const togglePlay = () => {
    if (!videoRef.current) return;

    // Reset to start if finished and not looping symmetrically
    if (!isPlaying && !symmetricLoop && videoRef.current.currentTime >= endTime) {
      videoRef.current.currentTime = startTime;
    }

    setIsPlaying(!isPlaying);
  };

  const handleManualSeek = (newTime: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(startTime, Math.min(endTime, newTime));
    setCurrentTime(newTime);
    directionRef.current = 'forward'; // Reset direction on manual interaction
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
        // Removed standard onPlay/onPause/timeupdate handlers from here
        // to control them fully via React state and Effects above
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
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const percentage = x / rect.width;
                const newTime = startTime + (duration * percentage);
                handleManualSeek(newTime);
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