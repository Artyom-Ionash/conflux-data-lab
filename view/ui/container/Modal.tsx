'use client';

import * as Dialog from '@radix-ui/react-dialog';
import React from 'react';

import { cn } from '../../../core/tailwind/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  className?: string; // Для кастомных размеров контента
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  headerActions,
  className = 'max-w-4xl',
}: ModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        {/* Overlay: затемнение фона с анимацией */}
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm" />

        {/* Content Wrapper: центрирование */}
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
          <Dialog.Content
            className={cn(
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%] flex max-h-[95vh] w-full flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl outline-none',
              className
            )}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-4">
              <Dialog.Title className="flex items-center gap-3 text-lg font-bold text-white">
                {title}
              </Dialog.Title>
              <div className="flex items-center gap-4">
                {headerActions}
                <Dialog.Close asChild>
                  <button
                    className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    aria-label="Close"
                  >
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </Dialog.Close>
              </div>
            </div>

            {/* Content Body */}
            <div className="custom-scrollbar flex flex-1 items-center justify-center overflow-auto bg-zinc-950 p-8">
              {children}
            </div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
