'use client';

import React from 'react';

import { Box } from '@/ui/atoms/layout/Box';
import { Stack } from '@/ui/atoms/layout/Layout';
import { Typography } from '@/ui/atoms/primitive/Typography';
import { Button } from '@/ui/molecules/input/Button';

import { FileDropzone } from './FileDropzone';
import { usePasteHandler } from './use-paste-handler';

interface SidebarIOProps {
  onFilesSelected: (files: File[]) => void;
  onScanStarted?: (() => void) | undefined;
  /**
   * ⚠️ КРИТИЧНО: Функция фильтрации путей.
   * Должна быть проброшена для инструментов, работающих с папками проектов,
   * чтобы активировать Smart Scan (игнорирование тяжелых папок на уровне системы).
   */
  shouldSkip?: ((path: string) => boolean) | undefined;
  accept?: string | undefined;
  multiple?: boolean | undefined;
  directory?: boolean | undefined;
  dropLabel?: string | undefined;
  hasFiles: boolean;

  onDownload?: (() => void) | undefined;
  downloadLabel?: string | undefined;
  isDownloading?: boolean | undefined;
  downloadDisabled?: boolean | undefined;

  children?: React.ReactNode | undefined;
}

/**
 * Унифицированный узел Ingestion (ввод) и Egestion (вывод).
 */
export function SidebarIO({
  onFilesSelected,
  onScanStarted,
  shouldSkip,
  accept,
  multiple = false,
  directory = false,
  dropLabel,
  hasFiles,
  onDownload,
  downloadLabel = 'Скачать PNG',
  isDownloading = false,
  downloadDisabled = false,
  children,
}: SidebarIOProps) {
  // --- PASTE SUPPORT ---
  usePasteHandler({
    onFilesReceived: (files) => {
      onScanStarted?.();
      // Передаем файлы так же, как и дропзона
      onFilesSelected(files);
    },
    enabled: true,
  });

  return (
    <Stack gap={3}>
      <FileDropzone
        onFilesSelected={onFilesSelected}
        onScanStarted={onScanStarted}
        shouldSkip={shouldSkip}
        accept={accept}
        multiple={multiple}
        directory={directory}
        label={dropLabel}
      />

      {/* Подсказка для пользователя */}
      <Typography.Text variant="dimmed" size="xs" align="center" className="opacity-60">
        Или нажмите Ctrl+V для вставки
      </Typography.Text>

      {hasFiles && onDownload && (
        <Box className="fx-slide-in border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <Button
            onClick={(e) => {
              e.preventDefault();
              onDownload();
            }}
            disabled={isDownloading || downloadDisabled}
            className="w-full shadow-sm"
            variant="default"
          >
            {isDownloading ? 'Экспорт...' : downloadLabel}
          </Button>
        </Box>
      )}

      {children}
    </Stack>
  );
}
