'use client';

import React from 'react';

import { Card } from '@/view/ui/container/Card';
import { Button, CopyButton } from '@/view/ui/input/Button';
import { Group } from '@/view/ui/layout/Layout';

interface ResultViewerProps {
  title: React.ReactNode;
  value: string | null;
  isCopied: boolean;
  onCopy: (text: string) => void;
  onDownload?: () => void;
  downloadLabel?: string;
  placeholder?: string;
  className?: string;
  footer?: React.ReactNode;
}

/**
 * Унифицированная панель для отображения текстовых результатов (код, логи, CSV).
 */
export function ResultViewer({
  title,
  value,
  isCopied,
  onCopy,
  onDownload,
  downloadLabel = 'Скачать',
  placeholder = 'Результат появится здесь...',
  className = '',
  footer,
}: ResultViewerProps) {
  return (
    <Card
      className={`flex flex-1 flex-col overflow-hidden ${className}`}
      title={title}
      contentClassName="p-0 flex-1 flex flex-col overflow-hidden"
      headerActions={
        value ? (
          <Group gap={2}>
            <CopyButton
              onCopy={() => onCopy(value)}
              isCopied={isCopied}
              variant="outline"
              size="xs"
            />
            {onDownload && (
              <Button onClick={onDownload} variant="default" size="xs">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {downloadLabel}
              </Button>
            )}
          </Group>
        ) : null
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <textarea
          value={value || ''}
          readOnly
          placeholder={placeholder}
          className="custom-scrollbar w-full flex-1 resize-none border-none bg-white p-4 font-mono text-[11px] leading-relaxed outline-none focus:ring-0 dark:bg-zinc-950"
        />
        {footer && (
          <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800">{footer}</div>
        )}
      </div>
    </Card>
  );
}
