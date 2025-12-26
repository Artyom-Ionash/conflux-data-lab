'use client';

import { useCallback, useState } from 'react';

import { downloadText } from '@/core/browser/canvas';
import { useCopyToClipboard } from '@/core/react/hooks/use-copy';
import { convertJsonToCsv } from '@/lib/converters/json-to-csv';
import { Card } from '@/view/ui/container/Card';
import { PanelHeader } from '@/view/ui/container/Panel';
import { Alert } from '@/view/ui/feedback/Alert';
import { Button } from '@/view/ui/input/Button';
import { TextArea } from '@/view/ui/input/Input';
import { Grid, Stack } from '@/view/ui/layout/Layout';
import { Workbench } from '@/view/ui/layout/Workbench';

import { ResultViewer } from './_io/ResultViewer';
import { SidebarIO } from './_io/SidebarIO';

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

  const handleFilesSelected = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    try {
      const text = await file.text();
      setJsonInput(text);
      // Важно: здесь вызываем handleConvert с аргументом, чтобы не зависеть от стейта jsonInput
      // Но сама функция handleConvert тоже должна быть стабильной или код перенесен сюда.
      // Проще продублировать логику конвертации или вынести её в чистую функцию за пределы компонента.

      // Лучший вариант - просто вызвать сеттер и конвертацию:
      try {
        setError('');
        const result = convertJsonToCsv(text);
        setCsvOutput(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Ошибка конвертации');
        setCsvOutput('');
      }
    } catch {
      setError('Не удалось прочитать файл');
    }
  }, []); // Пустой массив зависимостей, так как используем сеттеры

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
          <Grid className="h-full grid-cols-1 lg:grid-cols-2" gap={4}>
            {/* Input Column */}
            <Card
              className="flex flex-1 flex-col overflow-hidden"
              contentClassName="p-0 flex-1 flex flex-col h-full"
            >
              <PanelHeader
                title="Input JSON"
                action={
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
                }
              />

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

              {error && <Alert variant="error">{error}</Alert>}
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
          </Grid>
        </Workbench.Content>
      </Workbench.Stage>
    </Workbench.Root>
  );
}
