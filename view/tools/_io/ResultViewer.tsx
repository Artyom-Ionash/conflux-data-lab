'use client';

import React from 'react';

import { Card } from '@/view/ui/container/Card';
import { Button, CopyButton } from '@/view/ui/input/Button';
import { Group } from '@/view/ui/layout/Layout';
import { Icon } from '@/view/ui/primitive/Icon';

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
                <Icon.Download className="mr-1.5 h-3 w-3" />
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
