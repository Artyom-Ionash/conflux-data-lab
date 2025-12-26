'use client';

import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  checkDirectoryPickerSupport,
  type DirectorySupport,
  getLegacyDirectoryAttributes,
  LEGACY_MESSAGES,
} from '@/core/browser/legacy';
import { filterFileList, scanDirectoryHandle, scanEntries } from '@/lib/context-generator/scanner';
import { DropzoneVisual } from '@/view/ui/input/Dropzone';
import { Workbench } from '@/view/ui/layout/Workbench';

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
          {LEGACY_MESSAGES.FIREFOX_STATUS}
        </p>
        <p className="text-[10px] leading-tight font-bold text-amber-700 dark:text-amber-400/90">
          {LEGACY_MESSAGES.DND_REQUIRED}
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
    <svg
      className="h-10 w-10 text-blue-500/80 dark:text-blue-400/80"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  );

  return (
    <FileDropzone
      onFilesSelected={onUpload}
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
