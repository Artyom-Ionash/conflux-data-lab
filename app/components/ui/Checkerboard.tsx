import React from "react";

interface CheckerboardProps {
  children?: React.ReactNode;
  className?: string;
  size?: number; // Размер клетки
  color1?: string;
  color2?: string;
}

export function Checkerboard({
  children,
  className = "",
  size = 20,
  color1 = "#333",
  color2 = "transparent"
}: CheckerboardProps) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Background Pattern */}
      <div
        className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(45deg, ${color1} 25%, ${color2} 25%), 
            linear-gradient(-45deg, ${color1} 25%, ${color2} 25%), 
            linear-gradient(45deg, ${color2} 75%, ${color1} 75%), 
            linear-gradient(-45deg, ${color2} 75%, ${color1} 75%)
          `,
          backgroundSize: `${size}px ${size}px`
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}