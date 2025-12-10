import React, { RefObject } from "react";

interface DualHoverPreviewProps {
  activeThumb: 0 | 1;
  hoverTime: number;
  startTime: number;
  endTime: number;
  videoSrc: string | null;
  videoRef: RefObject<HTMLVideoElement>;
  previewStartImage: string | null;
  previewEndImage: string | null;
  aspectRatioStyle: React.CSSProperties;
}

export function DualHoverPreview({
  activeThumb,
  hoverTime,
  startTime,
  endTime,
  videoSrc,
  videoRef,
  previewStartImage,
  previewEndImage,
  aspectRatioStyle
}: DualHoverPreviewProps) {

  const renderFrame = (
    isActive: boolean,
    imageSrc: string | null,
    displayTime: number,
    label: string,
    colorClass: string,
    borderColorClass: string
  ) => (
    <div className={`relative flex flex-col items-center gap-2 transition-opacity duration-200 ${isActive ? 'opacity-100' : 'opacity-50 grayscale-[0.5]'}`}>
      <div
        className={`relative w-full bg-black rounded-lg overflow-hidden border-4 shadow-lg transition-all ${isActive ? borderColorClass : 'border-zinc-800'}`}
        style={aspectRatioStyle}
      >
        {imageSrc && <img src={imageSrc} alt={label.toLowerCase()} className="w-full h-full object-contain" />}
        {isActive && videoSrc && (
          <div className="absolute inset-0 bg-black">
            <video ref={videoRef} src={videoSrc} className="w-full h-full object-contain" muted playsInline />
          </div>
        )}
      </div>
      <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full shadow-sm ${isActive ? colorClass : 'bg-zinc-800 text-zinc-500'}`}>
        {label}: {displayTime.toFixed(2)}s
      </span>
    </div>
  );

  return (
    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-6 w-[98vw] max-w-[1600px] z-[100] pointer-events-none">
      <div className="grid grid-cols-2 gap-6 bg-zinc-950/95 backdrop-blur-md p-6 rounded-2xl shadow-2xl border border-white/10">
        {renderFrame(
          activeThumb === 0,
          previewStartImage,
          activeThumb === 0 ? hoverTime : startTime,
          "START",
          "bg-blue-600 text-white",
          "border-blue-500 shadow-blue-500/20"
        )}
        {renderFrame(
          activeThumb === 1,
          previewEndImage,
          activeThumb === 1 ? hoverTime : endTime,
          "END",
          "bg-purple-600 text-white",
          "border-purple-500 shadow-purple-500/20"
        )}
      </div>
    </div>
  );
}