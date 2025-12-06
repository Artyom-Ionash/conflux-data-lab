'use client';

import React, { useState, useRef, useEffect, ReactNode } from 'react';

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  multiple?: boolean;
  accept?: string;
  label?: string;
  className?: string;
  enableWindowDrop?: boolean;
  children?: ReactNode;
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

      {/* Глобальная индикация перетаскивания */}
      {enableWindowDrop && isDragActive && (
        <div className="fixed inset-0 z-[100] pointer-events-none border-4 border-blue-500/50 bg-blue-500/10 animate-pulse" />
      )}
    </>
  );
};

// --- Helper Component: Стандартная заглушка для Canvas ---
interface CanvasFilePlaceholderProps {
  onUpload: (files: File[]) => void;
  multiple?: boolean;
  text?: string;
  subText?: string;
}

export const CanvasFilePlaceholder = ({
  onUpload,
  multiple = false,
  text = "Перетащите изображения сюда",
  subText = "или кликните для выбора"
}: CanvasFilePlaceholderProps) => (
  <FileDropzone
    onFilesSelected={onUpload}
    multiple={multiple}
    className="w-full h-full border-none bg-transparent hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 transition-colors"
    enableWindowDrop={false} // Обычно в Canvas мы хотим локальный дроп, но можно включить если надо
  >
    <div className="flex flex-col items-center justify-center text-zinc-400 animate-in fade-in zoom-in-95 duration-300 pointer-events-none">
      <div className="p-4 rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4 transition-transform group-hover:scale-110 duration-200">
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
      <p className="text-lg font-medium mb-1 text-zinc-600 dark:text-zinc-300">{text}</p>
      <p className="text-sm opacity-60">{subText}</p>
    </div>
  </FileDropzone>
);