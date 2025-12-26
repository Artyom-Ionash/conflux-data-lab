'use client';

import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  checkDirectoryPickerSupport,
  COMPAT_MESSAGES,
  type DirectorySupport,
  getLegacyDirectoryAttributes,
} from '@/core/browser/compat';
import { filterFileList, scanDirectoryHandle, scanEntries } from '@/lib/context-generator/scanner';
import { DropzoneVisual } from '@/view/ui/input/Dropzone';
import { Workbench } from '@/view/ui/layout/Workbench';
import { Icon } from '@/view/ui/primitive/Icon';

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

  // --- HYDRATION FIX ---
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
        // @ts-expect-error - TS modern API
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
        .map((item) => item.webkitGetAsEntry())
        .filter((entry): entry is FileSystemEntry => entry !== null);

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
      if (e.relatedTarget === null || (e.relatedTarget as HTMLElement).nodeName === 'HTML') {
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

  // Warning Sub-label rendering logic
  const renderSubLabel = () => {
    if (!isWarning) return null;
    return (
      <div className="animate-in fade-in slide-in-from-top-1 mt-2 space-y-1">
        <p className="text-[10px] leading-tight font-medium text-amber-600/80 dark:text-amber-500/60">
          {COMPAT_MESSAGES.FIREFOX_STATUS}
        </p>
        <p className="text-[10px] leading-tight font-bold text-amber-700 dark:text-amber-400/90">
          {COMPAT_MESSAGES.DND_REQUIRED}
        </p>
      </div>
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

      {/* Input вынесен наружу, чтобы не считаться за children внутри DropzoneVisual */}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
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

// --- Specialized Component ---

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
