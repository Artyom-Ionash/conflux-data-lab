'use client';

import { useState } from 'react';

import { useCopyToClipboard } from '@/lib/core/hooks/use-copy-to-clipboard';
import { downloadText } from '@/lib/core/utils/media';
import { convertJsonToCsv } from '@/lib/modules/converters/json-to-csv';
import { Button } from '@/view/ui/Button';
import { Card } from '@/view/ui/Card';
import { TextArea } from '@/view/ui/Input';
import { Stack } from '@/view/ui/Layout';
import { Workbench } from '@/view/ui/Workbench';

import { ResultViewer } from './io/ResultViewer';
import { SidebarIO } from './io/SidebarIO';

const DEFAULT_EXAMPLE = JSON.stringify(
  [
    { id: 1, name: 'Engineer', department: 'R&D', active: true },
    { id: 2, name: 'Designer', department: 'UX', active: true },
    { id: 3, name: 'Manager', department: 'Sales', active: false },
  ],
  null,
  2
);

export function JsonToCsvConverter() {
  const [jsonInput, setJsonInput] = useState(DEFAULT_EXAMPLE);

  const [csvOutput, setCsvOutput] = useState(() => {
    try {
      return convertJsonToCsv(DEFAULT_EXAMPLE);
    } catch {
      return '';
    }
  });

  const [error, setError] = useState('');

  const { isCopied, copy } = useCopyToClipboard();

  const handleConvert = (input = jsonInput) => {
    try {
      setError('');
      if (!input.trim()) {
        setCsvOutput('');
        return;
      }
      const result = convertJsonToCsv(input);
      setCsvOutput(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка конвертации');
      setCsvOutput('');
    }
  };

  const handleFilesSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    try {
      const text = await file.text();
      setJsonInput(text);
      handleConvert(text);
    } catch (err) {
      setError('Не удалось прочитать файл');
    }
  };

  const handleDownload = () => {
    if (csvOutput) {
      downloadText(csvOutput, 'converted.csv');
    }
  };

  const sidebarContent = (
    <Stack gap={6}>
      <Workbench.Header title="JSON → CSV" />

      <SidebarIO
        onFilesSelected={handleFilesSelected}
        accept=".json"
        dropLabel="Загрузить JSON"
        hasFiles={!!csvOutput}
        onDownload={handleDownload}
        downloadLabel="Скачать CSV"
      />
    </Stack>
  );

  return (
    <Workbench.Root>
      <Workbench.Sidebar>{sidebarContent}</Workbench.Sidebar>
      <Workbench.Stage>
        <Workbench.Content>
          <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Input Column */}
            <Card
              className="flex flex-1 flex-col overflow-hidden"
              contentClassName="p-0 flex-1 flex flex-col h-full"
            >
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900">
                <span className="text-xs font-semibold text-zinc-500 uppercase">Input JSON</span>
                <Button
                  onClick={() => {
                    setJsonInput('');
                    setCsvOutput('');
                    setError('');
                  }}
                  variant="destructive"
                  size="xs"
                >
                  Очистить
                </Button>
              </div>
              <TextArea
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  if (error) setError('');
                }}
                onBlur={() => handleConvert()}
                placeholder='[{"name": "John", "age": 30}]'
                className="flex-1 resize-none border-0 p-4 font-mono text-xs focus:ring-0"
              />
              {error && (
                <div className="bg-red-50 p-3 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}
            </Card>

            {/* Output Column */}
            <ResultViewer
              title="Output CSV"
              value={csvOutput}
              isCopied={isCopied}
              onCopy={copy}
              onDownload={handleDownload}
              downloadLabel="Скачать CSV"
              className="flex-1"
            />
          </div>
        </Workbench.Content>
      </Workbench.Stage>
    </Workbench.Root>
  );
}
