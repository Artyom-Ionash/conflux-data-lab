'use client';

import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  checkDirectoryPickerSupport,
  type DirectorySupport,
  getLegacyDirectoryAttributes,
  LEGACY_MESSAGES,
} from '@/core/browser/legacy';
import { cn } from '@/core/tailwind/utils';
import { filterFileList, scanDirectoryHandle, scanEntries } from '@/lib/context-generator/_scanner';

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

/**
 * Универсальный сенсор для загрузки файлов и папок.
 * * Поддерживает:
 * 1. Modern File System Access API (showDirectoryPicker)
 * 2. Legacy Input (webkitdirectory)
 * 3. Drag and Drop (DataTransfer items)
 *
 * ⚠️ ПРЕДУПРЕЖДЕНИЕ О ПРОИЗВОДИТЕЛЬНОСТИ:
 * Этот компонент реализует "Smart Scan" через API FileSystemEntry (webkitGetAsEntry).
 * Это критически важно для тяжелых проектов (5000+ файлов), так как позволяет
 * отсекать папки типа node_modules ДО их загрузки в память браузера.
 *
 * При рефакторинге НЕЛЬЗЯ заменять ручной обход entries на DataTransfer.files,
 * иначе браузер зависнет, пытаясь создать объекты File для каждой иконки в node_modules.
 */
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
  // Инициализируем «серверным» значением (modern), чтобы избежать нестыковки при гидратации.
  const [support, setSupport] = useState<DirectorySupport>({
    isSupported: true,
    isFirefox: false,
    status: 'modern',
  });

  // Проверяем реальную поддержку только после того, как компонент «ожил» в браузере.
  useEffect(() => {
    // Используем requestAnimationFrame, чтобы избежать синхронного каскадного рендера
    // и удовлетворить правило react-hooks/set-state-in-effect.
    requestAnimationFrame(() => {
      setSupport(checkDirectoryPickerSupport());
    });
  }, []);
  // ---------------------

  const isWarning = directory && !support.isSupported;

  const handleFinalFiles = useCallback(
    (filesArray: File[]) => {
      const validFiles = shouldSkip ? filterFileList(filesArray, shouldSkip) : filesArray;
      if (validFiles.length > 0) onFilesSelected(validFiles);
    },
    [onFilesSelected, shouldSkip]
  );

  const handleClick = async () => {
    // 1. Если это режим папки и браузер поддерживает Modern API
    if (directory && support.isSupported) {
      try {
        // @ts-expect-error - TS может не знать про window.showDirectoryPicker
        const dirHandle = await window.showDirectoryPicker();
        onScanStarted?.();
        const files = await scanDirectoryHandle(dirHandle, shouldSkip);
        handleFinalFiles(files);
        return;
      } catch (err) {
        // Игнорируем AbortError (если пользователь нажал Отмена)
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    // 2. Стандартный (Legacy) путь
    inputRef.current?.click();
  };

  const handleDataTransfer = useCallback(
    async (dataTransfer: DataTransfer) => {
      // Мгновенный вызов необходим, чтобы React успел переключить флаг loading
      // до того, как тяжелый синхронный цикл сканирования заблокирует поток.
      onScanStarted?.();

      const items = Array.from(dataTransfer.items);
      const entries = items
        .map((item) => item.webkitGetAsEntry())
        .filter((entry): entry is FileSystemEntry => entry !== null);

      if (entries.length > 0) {
        // [FAST PATH] Рекурсивный обход с ранним игнорированием (Smart Scan)
        const allFiles = await scanEntries(entries, shouldSkip);
        handleFinalFiles(allFiles);
      } else {
        // [SLOW PATH] Системный диалог или старые браузеры
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

  return (
    <div
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
      className={cn(
        'group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden transition-all duration-300',
        'rounded-xl border-2 border-dashed',
        isDragActive
          ? 'scale-[1.01] border-blue-500 bg-blue-50/50 dark:bg-blue-500/10'
          : isWarning
            ? 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10'
            : 'border-zinc-300 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900/50',
        className
      )}
    >
      {children || (
        <div className="pointer-events-none flex flex-col items-center justify-center px-6 py-7 text-center">
          <svg
            className={cn(
              'mb-3 h-9 w-9 transition-colors duration-300',
              isDragActive ? 'text-blue-500' : isWarning ? 'text-amber-500/70' : 'text-zinc-400'
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5"
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <div className="space-y-1">
            <p
              className={cn(
                'text-xs font-bold tracking-tight uppercase transition-colors',
                isWarning
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-zinc-500 dark:text-zinc-400'
              )}
            >
              {isDragActive ? 'Бросайте файлы' : label}
            </p>

            {isWarning && (
              <div className="animate-in fade-in slide-in-from-top-1 mt-2 space-y-1">
                <p className="text-[10px] leading-tight font-medium text-amber-600/80 dark:text-amber-500/60">
                  {LEGACY_MESSAGES.FIREFOX_STATUS}
                </p>
                <p className="text-[10px] leading-tight font-bold text-amber-700 dark:text-amber-400/90">
                  {LEGACY_MESSAGES.DND_REQUIRED}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

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
    </div>
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
}

export const FileDropzonePlaceholder = ({
  onUpload,
  multiple = false,
  enableWindowDrop = false,
  className = '',
  title = 'Перетащите изображения сюда',
  subTitle = 'или кликните для выбора',
  accept = 'image/*',
}: PlaceholderProps) => (
  <FileDropzone
    onFilesSelected={onUpload}
    multiple={multiple}
    enableWindowDrop={enableWindowDrop}
    accept={accept}
    className={cn(
      'h-full w-full border-none bg-transparent hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50',
      className
    )}
  >
    <div className="flex flex-col items-center justify-center text-zinc-400">
      <div className="mb-4 rounded-full bg-zinc-100 p-4 transition-transform group-hover:scale-110 dark:bg-zinc-800">
        <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <p className="mb-1 text-lg font-medium text-zinc-600 dark:text-zinc-300">{title}</p>
      <p className="text-sm opacity-60">{subTitle}</p>
    </div>
  </FileDropzone>
);
