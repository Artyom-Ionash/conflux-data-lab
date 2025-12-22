'use client';

import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  filterFileList,
  scanDirectoryHandle,
  scanEntries,
} from '@/lib/modules/file-system/scanner';
import { cn } from '@/view/ui/infrastructure/standards';
import { Tooltip } from '@/view/ui/ZoneIndicator';

// --- Types ---

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

  const handleFinalFiles = useCallback(
    (filesArray: File[]) => {
      const preFiltered = shouldSkip ? filterFileList(filesArray, shouldSkip) : filesArray;

      const isAllAccepted = !accept || accept === '*' || accept === '';
      const validFiles = isAllAccepted
        ? preFiltered
        : preFiltered.filter((file) => {
            if (!accept) return true;
            // Здесь может быть доп. валидация типов, если нужно
            return true;
          });

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [accept, onFilesSelected, shouldSkip]
  );

  // Обработчик клика: Пробуем Modern API, откатываемся на Legacy
  const handleClick = async () => {
    // 1. Если это режим папки и браузер поддерживает Modern API
    if (directory && 'showDirectoryPicker' in window) {
      try {
        // @ts-expect-error - TS может не знать про window.showDirectoryPicker
        const dirHandle = await window.showDirectoryPicker();

        onScanStarted?.();

        // Используем новую функцию из scanner.ts
        const files = await scanDirectoryHandle(dirHandle, shouldSkip);
        handleFinalFiles(files);
        return;
      } catch (err) {
        // Игнорируем AbortError (если пользователь нажал Отмена)
        if (err instanceof Error && err.name === 'AbortError') return;

        console.warn('Modern directory picker failed, falling back to input', err);
        // Если произошла другая ошибка, проваливаемся к input.click() ниже
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

  const directoryProps = directory
    ? ({
        webkitdirectory: '',
        directory: '',
      } as React.InputHTMLAttributes<HTMLInputElement> & {
        webkitdirectory?: string;
        directory?: string;
      })
    : {};

  return (
    <>
      <div
        onClick={handleClick}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragActive(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragActive(false);
          if (e.dataTransfer) void handleDataTransfer(e.dataTransfer);
        }}
        className={cn(
          'group relative flex cursor-pointer flex-col items-center justify-center transition-all duration-200',
          !className?.includes('border') && 'rounded-lg border-2 border-dashed',
          !className?.includes('h-') && 'h-24',
          isDragActive
            ? 'scale-[1.01] border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-900/20'
            : 'border-zinc-300 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800',
          className
        )}
      >
        {directory && (
          <div className="absolute top-2 right-2 z-10">
            <Tooltip
              side="left"
              content={
                <div className="space-y-1.5">
                  <p className="font-bold text-blue-400 uppercase">Совет по производительности</p>
                  <p>
                    Выбор папки через диалог заставляет браузер сканировать{' '}
                    <span className="font-bold text-white">все</span> файлы перед началом работы.
                  </p>
                  <p className="border-t border-zinc-700 pt-1.5 opacity-80">
                    Для мгновенного сканирования больших проектов используйте{' '}
                    <span className="italic">Drag-and-Drop</span>.
                  </p>
                </div>
              }
            >
              <div className="rounded-full bg-zinc-200 p-1 text-zinc-500 transition-colors hover:bg-blue-500 hover:text-white dark:bg-zinc-700 dark:text-zinc-400">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </div>
            </Tooltip>
          </div>
        )}

        {children || (
          <div className="pointer-events-none flex flex-col items-center justify-center pt-5 pb-6 text-center">
            <svg
              className={cn(
                'mb-2 h-8 w-8 transition-colors',
                isDragActive ? 'text-blue-500' : 'text-zinc-400 dark:text-zinc-500'
              )}
              fill="none"
              viewBox="0 0 20 16"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
              />
            </svg>
            <p
              className={cn(
                'px-4 text-xs font-medium',
                isDragActive
                  ? 'text-blue-600 dark:text-blue-300'
                  : 'text-zinc-500 dark:text-zinc-400'
              )}
            >
              {isDragActive ? 'Бросайте сюда' : label}
            </p>
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
          {...directoryProps}
        />
      </div>
      {enableWindowDrop && isDragActive && (
        <div className="pointer-events-none fixed inset-0 z-[100] animate-pulse border-4 border-blue-500/50 bg-blue-500/10" />
      )}
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
