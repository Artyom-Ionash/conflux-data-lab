'use client';

import type { ReactNode } from 'react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from './infrastructure/standards';

// --- Helper: Validate File Type ---
const isFileAccepted = (file: File, accept: string): boolean => {
  if (!accept || accept === '*' || accept === '') return true;

  const acceptedTypes = accept.split(',').map((t) => t.trim().toLowerCase());
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  return acceptedTypes.some((type) => {
    // 1. Проверка расширения (например, .jpg)
    if (type.startsWith('.')) {
      return fileName.endsWith(type);
    }
    // 2. Проверка MIME wildcard (например, image/*)
    if (type.endsWith('/*')) {
      const mainType = type.replace('/*', '');
      // Если файл имеет MIME тип, проверяем начало.
      // Важно: иногда file.type бывает пустым, тогда полагаемся на расширение или отвергаем.
      if (fileType) {
        return fileType.startsWith(mainType);
      }
      return false;
    }
    // 3. Точное совпадение MIME (например, image/jpeg)
    return fileType === type;
  });
};

// --- Base Component Props ---
interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  label?: string;
  className?: string;
  enableWindowDrop?: boolean;
  children?: ReactNode;
  /** Поддержка выбора папок */
  directory?: boolean;
}

// --- Base Component ---
export const FileDropzone = ({
  onFilesSelected,
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

  // Обработка списка файлов с валидацией
  const processFiles = useCallback(
    (fileList: FileList | File[]) => {
      const filesArray = Array.from(fileList);
      // Если accept="*", пропускаем валидацию
      const validFiles =
        accept === '*' ? filesArray : filesArray.filter((file) => isFileAccepted(file, accept));

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [accept, onFilesSelected]
  );

  // --- Global DnD (Window) ---
  useEffect(() => {
    if (!enableWindowDrop) return;

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragActive(true);
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      if (e.relatedTarget === null || (e.relatedTarget as HTMLElement).nodeName === 'HTML') {
        setIsDragActive(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        processFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [enableWindowDrop, processFiles]);

  // --- Local Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    e.target.value = ''; // Сброс value, чтобы можно было выбрать тот же файл повторно
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  // [LEMON] Безопасная типизация нестандартных атрибутов
  const directoryAttributes = directory
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
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processFiles(e.dataTransfer.files);
          }
        }}
        className={cn(
          'group relative flex cursor-pointer flex-col items-center justify-center transition-all duration-200',
          !className.includes('border') && 'rounded-lg border-2 border-dashed',
          !className.includes('h-') && 'h-24',
          !className.includes('w-') && 'w-full',
          isDragActive
            ? 'scale-[1.01] border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-900/20'
            : 'border-zinc-300 bg-zinc-50 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800',
          className
        )}
      >
        {children || (
          <div className="pointer-events-none flex flex-col items-center justify-center pt-5 pb-6">
            <svg
              className={cn(
                'mb-2 h-8 w-8 transition-colors',
                isDragActive
                  ? 'text-blue-500'
                  : 'text-zinc-400 group-hover:text-zinc-500 dark:text-zinc-500 dark:group-hover:text-zinc-400'
              )}
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
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
                'text-xs font-medium transition-colors',
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
          onChange={handleInputChange}
          {...directoryAttributes}
        />
      </div>

      {enableWindowDrop && isDragActive && (
        <div className="pointer-events-none fixed inset-0 z-[100] animate-pulse border-4 border-blue-500/50 bg-blue-500/10" />
      )}
    </>
  );
};

// --- Specialized Component: Full Size Placeholder ---

interface FileDropzonePlaceholderProps {
  onUpload: (files: File[]) => void;
  multiple?: boolean;
  enableWindowDrop?: boolean;
  className?: string;
  title?: string;
  subTitle?: string;
  accept?: string;
}

export const FileDropzonePlaceholder = ({
  onUpload,
  multiple = false,
  enableWindowDrop = false,
  className = '',
  title = 'Перетащите изображения сюда',
  subTitle = 'или кликните для выбора',
  accept = 'image/*',
}: FileDropzonePlaceholderProps) => {
  return (
    <FileDropzone
      onFilesSelected={onUpload}
      multiple={multiple}
      enableWindowDrop={enableWindowDrop}
      accept={accept}
      className={cn(
        'h-full w-full border-none bg-transparent transition-colors hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50',
        className
      )}
    >
      <div className="animate-in fade-in zoom-in-95 flex flex-col items-center justify-center text-zinc-400 duration-300">
        <div className="mb-4 rounded-full bg-zinc-100 p-4 transition-transform duration-200 group-hover:scale-110 dark:bg-zinc-800">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
        <p className="mb-1 text-center text-lg font-medium text-zinc-600 dark:text-zinc-300">
          {title}
        </p>
        <p className="text-center text-sm opacity-60">{subTitle}</p>
      </div>
    </FileDropzone>
  );
};
