'use client';

import React, { useCallback, useState, useRef, useEffect, ReactNode } from 'react';

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  label?: string;
  className?: string;
  enableWindowDrop?: boolean;
  children?: ReactNode; // <-- Позволяет передавать кастомную верстку внутрь
}

export const FileDropzone = ({
  onFilesSelected,
  multiple = false,
  accept = "image/*",
  label = "Загрузить изображение",
  className = "",
  enableWindowDrop = true,
  children,
}: FileDropzoneProps) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Global DnD (Window) ---
  useEffect(() => {
    if (!enableWindowDrop) return;

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      setIsDragActive(true);
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // Проверка: мы действительно покинули окно или просто перешли на дочерний элемент?
      if (e.relatedTarget === null || (e.relatedTarget as HTMLElement).nodeName === "HTML") {
        setIsDragActive(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragActive(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        onFilesSelected(Array.from(e.dataTransfer.files));
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
  }, [enableWindowDrop, onFilesSelected]);

  // --- Local Handlers ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
    e.target.value = '';
  };

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center cursor-pointer transition-all duration-200 group
          ${isDragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400 scale-[1.01] shadow-lg ring-2 ring-blue-500/20'
            : 'border-zinc-300 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/50 dark:border-zinc-700 dark:hover:bg-zinc-800'
          }
          ${className.includes('border') ? '' : 'border-2 border-dashed rounded-lg'} 
          ${className.includes('h-') ? '' : 'h-24'}
          ${className.includes('w-') ? '' : 'w-full'}
          ${className}
        `}
      >
        {children ? (
          children
        ) : (
          <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
            <svg
              className={`w-8 h-8 mb-2 transition-colors ${isDragActive ? 'text-blue-500' : 'text-zinc-400 group-hover:text-zinc-500 dark:text-zinc-500 dark:group-hover:text-zinc-400'}`}
              aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16"
            >
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
            </svg>
            <p className={`text-xs font-medium transition-colors ${isDragActive ? 'text-blue-600 dark:text-blue-300' : 'text-zinc-500 dark:text-zinc-400'}`}>
              {isDragActive ? (multiple ? 'Бросайте файлы сюда' : 'Бросайте файл сюда') : label}
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          multiple={multiple}
          accept={accept}
          onChange={handleInputChange}
        />
      </div>

      {/* Глобальная индикация перетаскивания (опционально) */}
      {enableWindowDrop && isDragActive && (
        <div className="fixed inset-0 z-[100] pointer-events-none border-4 border-blue-500/50 bg-blue-500/10 animate-pulse" />
      )}
    </>
  );
};