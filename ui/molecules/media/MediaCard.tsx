'use client';

import React from 'react';

import { Card } from '@/ui/atoms/container/Card';
import { AspectRatio } from '@/ui/atoms/layout/AspectRatio';
import { Typography } from '@/ui/atoms/primitive/Typography';

interface MediaCardProps {
  title: string;
  ratio: number;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Стандартизированная карточка для мониторов видео-инструмента.
 * Композиция: Card + AspectRatio + Typography.
 */
export function MediaCard({ title, ratio, actions, children, className }: MediaCardProps) {
  return (
    <Card
      className={`flex flex-col overflow-hidden shadow-sm ${className}`}
      title={<Typography.Text variant="label">{title}</Typography.Text>}
      headerActions={actions}
      contentClassName="p-0"
    >
      <AspectRatio ratio={ratio} className="bg-black dark:bg-zinc-950">
        {children}
      </AspectRatio>
    </Card>
  );
}
