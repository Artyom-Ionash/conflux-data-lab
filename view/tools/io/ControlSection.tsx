'use client';

import React from 'react';

import { cn } from '../../ui/infrastructure/standards';
import { Typography } from '../../ui/Typography';

// --- SUB-COMPONENT: SectionHeader ---
interface SectionHeaderProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Унифицированный заголовок для секций сайдбара с поддержкой кнопок действий.
 */
export function SectionHeader({ title, actions, className = '' }: SectionHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-center justify-between px-0.5', className)}>
      <Typography.Text variant="label">{title}</Typography.Text>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// --- MAIN COMPONENT: ControlSection ---
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
      className={cn(
        'rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800',
        className
      )}
    >
      {title || headerRight ? (
        <SectionHeader
          title={title}
          actions={headerRight}
          className="mb-3 border-b border-zinc-200 pb-2 dark:border-zinc-700"
        />
      ) : null}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
