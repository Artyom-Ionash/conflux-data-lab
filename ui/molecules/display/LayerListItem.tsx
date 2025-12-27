'use client';

import React from 'react';

import { Card } from '@/ui/atoms/container/Card';
import { Icon } from '@/ui/atoms/primitive/Icon';
import { Typography } from '@/ui/atoms/primitive/Typography';
import { Button } from '@/ui/molecules/input/Button';

interface LayerListItemProps extends React.HTMLAttributes<HTMLElement> {
  index: number;
  name: string;
  isActive: boolean;
  onActivate: () => void;
  onRemove: (e: React.MouseEvent) => void;
  isDragging?: boolean;
}

/**
 * Элемент списка слоев для вертикального склейщика.
 * Изолирует стили drag-and-drop и активного состояния.
 */
export function LayerListItem({
  index,
  name,
  isActive,
  onActivate,
  onRemove,
  isDragging = false,
  className,
  ...props // Drag props from dnd-kit
}: LayerListItemProps) {
  return (
    <Card
      {...props}
      variant="default"
      active={isActive}
      className={`cursor-grab select-none active:cursor-grabbing ${isDragging ? 'opacity-50' : ''} ${className}`}
      onClick={onActivate}
      contentClassName="p-2.5 flex items-center gap-3"
    >
      <Typography.Text variant="dimmed" className="w-6 shrink-0 font-mono text-xs">
        #{index + 1}
      </Typography.Text>
      <Typography.Text className="min-w-0 flex-1 truncate font-medium">{name}</Typography.Text>
      <Button
        variant="destructive"
        size="xs"
        className="h-6 w-6 shrink-0 p-0"
        title="Удалить"
        onClick={onRemove}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Icon.Trash className="h-3.5 w-3.5" />
      </Button>
    </Card>
  );
}
