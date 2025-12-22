'use client';

import React from 'react';

import { DownloadButton } from '@/view/ui/DownloadButton';
import { Stack } from '@/view/ui/Layout';

import { FileDropzone } from './FileDropzone';

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
 * [КРИСТАЛЛ] SidebarIO
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

      {hasFiles && onDownload && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <DownloadButton
            onDownload={onDownload}
            label={isDownloading ? 'Экспорт...' : downloadLabel}
            disabled={isDownloading || downloadDisabled}
            className="w-full shadow-sm"
          />
        </div>
      )}

      {children}
    </Stack>
  );
}
