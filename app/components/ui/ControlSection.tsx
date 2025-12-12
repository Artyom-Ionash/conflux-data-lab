import React from 'react';

// --- Sub-component: Typography ---
// Экспортируем для использования вне ControlSection (например, заголовки списков)
interface ControlLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function ControlLabel({ children, className = '' }: ControlLabelProps) {
  return (
    <div
      className={`text-xs font-bold tracking-wide text-zinc-500 uppercase dark:text-zinc-400 ${className}`}
    >
      {children}
    </div>
  );
}

// --- Main Component: Container ---
interface ControlSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}

export function ControlSection({
  title,
  children,
  className = '',
  headerRight,
}: ControlSectionProps) {
  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800 ${className}`}
    >
      {(title || headerRight) && (
        <div className="mb-3 flex items-center justify-between border-b border-zinc-200 pb-2 dark:border-zinc-700">
          {/* Используем локальный компонент */}
          {title && <ControlLabel>{title}</ControlLabel>}
          {headerRight}
        </div>
      )}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
