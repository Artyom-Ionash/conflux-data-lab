'use client';

import React from 'react';

import { cn } from '@/core/tailwind/utils';
import { Typography } from '@/ui/atoms/primitive/Typography';

export interface SectionHeaderProps {
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, actions, className = '' }: SectionHeaderProps) {
  return (
    <div className={cn('mb-3 flex items-center justify-between px-0.5', className)}>
      <Typography.Text variant="label">{title}</Typography.Text>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

interface SectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
  variant?: 'default' | 'ghost';
}

export function Section({
  title,
  children,
  className = '',
  headerRight,
  variant = 'default',
}: SectionProps) {
  return (
    <div
      className={cn(
        'rounded-lg',
        variant === 'default' &&
          'border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800',
        variant === 'ghost' && 'border-0 bg-transparent p-0',
        className
      )}
    >
      {title || headerRight ? (
        <SectionHeader
          title={title}
          actions={headerRight}
          className={cn(
            'mb-3',
            variant === 'default' && 'border-b border-zinc-200 pb-2 dark:border-zinc-700'
          )}
        />
      ) : null}
      <div className="space-y-3">{children}</div>
    </div>
  );
}
