'use client';

import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  checkDirectoryPickerSupport,
  COMPAT_MESSAGES,
  type DirectorySupport,
  getLegacyDirectoryAttributes,
} from '@/core/browser/compat';
import { isInstanceOf } from '@/core/primitives/guards';
import { filterFileList, scanDirectoryHandle, scanEntries } from '@/lib/context-generator/scanner';
import { HiddenInput } from '@/ui/atoms/input/Input';
import { Stack } from '@/ui/atoms/layout/Layout';
import { Icon } from '@/ui/atoms/primitive/Icon';
import { Typography } from '@/ui/atoms/primitive/Typography';
import { DropzoneVisual } from '@/ui/molecules/input/Dropzone';
import { Workbench } from '@/ui/molecules/layout/Workbench';

// --- Type Guards & Interfaces ---

interface WebkitDataTransferItem extends DataTransferItem {
  webkitGetAsEntry(): FileSystemEntry | null;
}

function isFileSystemEntry(entry: unknown): entry is FileSystemEntry {
  return typeof entry === 'object' && entry !== null && 'isFile' in entry && 'isDirectory' in entry;
}

function hasWebkitGetAsEntry(item: DataTransferItem): item is WebkitDataTransferItem {
  return 'webkitGetAsEntry' in item;
}

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  onScanStarted?: (() => void) | undefined;
  shouldSkip?: ((path: string) => boolean) | undefined;
  multiple?: boolean | undefined;
  accept?: string | undefined;
  label?: string | undefined;
  className?: string | undefined;
  enableWindowDrop?: boolean | undefined;
  children?: ReactNode | undefined;
  directory?: boolean | undefined;
}

export const FileDropzone = ({
  onFilesSelected,
  onScanStarted,
  shouldSkip,
  multiple = false,
  accept = 'image/*',
  label = 'Загрузить изображение',
  className = '',
  enableWindowDrop = true,
  children,
  directory = false,
}: FileDropzoneProps) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [support, setSupport] = useState<DirectorySupport>({
    isSupported: true,
    isFirefox: false,
    status: 'modern',
  });

  useEffect(() => {
    requestAnimationFrame(() => {
      setSupport(checkDirectoryPickerSupport());
    });
  }, []);

  const isWarning = directory && !support.isSupported;

  const handleFinalFiles = useCallback(
    (filesArray: File[]) => {
      const validFiles = shouldSkip ? filterFileList(filesArray, shouldSkip) : filesArray;
      if (validFiles.length > 0) onFilesSelected(validFiles);
    },
    [onFilesSelected, shouldSkip]
  );

  const handleClick = async () => {
    if (directory && support.isSupported) {
      try {
        // @ts-expect-error - TS modern API missing in types
        const dirHandle = await window.showDirectoryPicker();
        onScanStarted?.();
        const files = await scanDirectoryHandle(dirHandle, shouldSkip);
        handleFinalFiles(files);
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    inputRef.current?.click();
  };

  const handleDataTransfer = useCallback(
    async (dataTransfer: DataTransfer) => {
      onScanStarted?.();
      const items = Array.from(dataTransfer.items);
      const entries = items
        .map((item) => {
          if (hasWebkitGetAsEntry(item)) {
            return item.webkitGetAsEntry();
          }
          return null;
        })
        .filter(isFileSystemEntry);

      if (entries.length > 0) {
        const allFiles = await scanEntries(entries, shouldSkip);
        handleFinalFiles(allFiles);
      } else {
        handleFinalFiles(Array.from(dataTransfer.files));
      }
    },
    [handleFinalFiles, onScanStarted, shouldSkip]
  );

  useEffect(() => {
    if (!enableWindowDrop) return;
    const handleDrag = (e: DragEvent) => {
      e.preventDefault();
      setIsDragActive(true);
    };
    const handleLeave = (e: DragEvent) => {
      e.preventDefault();
      // nodeName 'HTML' указывает на выход курсора за пределы окна.
      if (
        e.relatedTarget === null ||
        (isInstanceOf(e.relatedTarget, HTMLElement) && e.relatedTarget.nodeName === 'HTML')
      ) {
        setIsDragActive(false);
      }
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
      if (e.dataTransfer) void handleDataTransfer(e.dataTransfer);
    };
    window.addEventListener('dragover', handleDrag);
    window.addEventListener('dragleave', handleLeave);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragover', handleDrag);
      window.removeEventListener('dragleave', handleLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [enableWindowDrop, handleDataTransfer]);

  const renderSubLabel = () => {
    if (!isWarning) return null;
    return (
      <Stack gap={1} className="animate-in fade-in slide-in-from-top-1 mt-2">
        <Typography.Text
          size="xs"
          weight="medium"
          className="text-amber-600/80 dark:text-amber-500/60"
        >
          {COMPAT_MESSAGES.FIREFOX_STATUS}
        </Typography.Text>
        <Typography.Text size="xs" weight="bold" className="text-amber-700 dark:text-amber-400/90">
          {COMPAT_MESSAGES.DND_REQUIRED}
        </Typography.Text>
      </Stack>
    );
  };

  return (
    <>
      <DropzoneVisual
        onClick={handleClick}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={() => setIsDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragActive(false);
          if (e.dataTransfer) void handleDataTransfer(e.dataTransfer);
        }}
        isDragActive={isDragActive}
        isWarning={isWarning}
        label={label}
        subLabel={renderSubLabel()}
        className={className}
        icon={
          !isDragActive && !isWarning ? (
            <Icon.UploadCloud className="mb-3 h-9 w-9 text-zinc-400" />
          ) : undefined
        }
      >
        {children}
      </DropzoneVisual>

      <HiddenInput
        ref={inputRef}
        type="file"
        multiple={multiple || directory}
        accept={accept}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onScanStarted?.();
            handleFinalFiles(Array.from(e.target.files));
            e.target.value = '';
          }
        }}
        {...(directory ? getLegacyDirectoryAttributes() : {})}
      />
    </>
  );
};

interface PlaceholderProps {
  onUpload: (files: File[]) => void;
  shouldSkip?: ((path: string) => boolean) | undefined;
  multiple?: boolean | undefined;
  enableWindowDrop?: boolean | undefined;
  className?: string | undefined;
  title?: string | undefined;
  subTitle?: string | undefined;
  accept?: string | undefined;
  directory?: boolean | undefined;
  icon?: React.ReactNode;
}

export const FileDropzonePlaceholder = ({
  onUpload,
  shouldSkip,
  multiple = false,
  enableWindowDrop = false,
  className = '',
  title = 'Загрузите файлы',
  subTitle = 'Перетащите сюда или кликните для выбора',
  accept = 'image/*',
  directory = false,
  icon,
}: PlaceholderProps) => {
  const DefaultIcon = (
    <Icon.UploadCloud className="h-10 w-10 text-blue-500/80 dark:text-blue-400/80" />
  );

  return (
    <FileDropzone
      onFilesSelected={onUpload}
      shouldSkip={shouldSkip}
      multiple={multiple}
      enableWindowDrop={enableWindowDrop}
      accept={accept}
      directory={directory}
      label=""
      className={`h-full border-0 bg-transparent hover:bg-transparent dark:bg-transparent ${className}`}
    >
      <Workbench.EmptyState
        icon={icon || DefaultIcon}
        title={title}
        description={subTitle}
        className="pointer-events-none"
      />
    </FileDropzone>
  );
};
