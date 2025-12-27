'use client';

import React from 'react';

import { Box } from '@/ui/atoms/layout/Box';
import { Group, Stack } from '@/ui/atoms/layout/Layout';
import { Typography } from '@/ui/atoms/primitive/Typography';

interface PropertyRowProps {
  label: string;
  valueDisplay: React.ReactNode;
  control: React.ReactNode;
  preview?: React.ReactNode;
  className?: string;
}

/**
 * [MOLECULE] Универсальная строка настройки свойства.
 * Паттерн: [Превью] [Контрол + Подпись + Значение]
 */
export function PropertyRow({
  label,
  valueDisplay,
  control,
  preview,
  className = '',
}: PropertyRowProps) {
  return (
    <Group gap={3} className={className}>
      {preview && <Box className="shrink-0">{preview}</Box>}
      <Group
        gap={2}
        className="flex-1 rounded border bg-zinc-50 p-2 dark:border-zinc-700 dark:bg-zinc-800"
      >
        {control}
        <Stack gap={0} className="min-w-0 flex-1">
          <Typography.Text variant="label" className="truncate opacity-70">
            {label}
          </Typography.Text>
          <div className="font-mono text-xs font-bold uppercase">{valueDisplay}</div>
        </Stack>
      </Group>
    </Group>
  );
}
