import React from 'react';

interface GridOverlayProps {
  color?: string;
  step: number;
  offsetX?: number;
  offsetY?: number;
  slotHeight: number;
  dash?: number;
  opacity?: number;
  zIndex?: string;
}

export function CanvasGridOverlay({
  color = '#00ff00',
  step,
  offsetX = 0,
  offsetY = 0,
  slotHeight,
  dash,
  opacity = 0.5,
  zIndex,
}: GridOverlayProps) {
  const gradientStyle = dash
    ? `linear-gradient(to right, ${color} ${dash}px, transparent ${dash}px), linear-gradient(to bottom, ${color} ${dash}px, transparent ${dash}px)`
    : `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`;

  // CSS offset format: "x y"
  const backgroundPosition = dash ? '-5px -5px' : `${offsetX}px ${offsetY}px`;

  return (
    <div
      className="fx-cover pointer-events-none"
      style={{
        zIndex,
        opacity,
        backgroundImage: gradientStyle,
        backgroundSize: `${step}px ${slotHeight}px`,
        backgroundPosition,
      }}
    />
  );
}
