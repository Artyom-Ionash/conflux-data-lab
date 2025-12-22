'use client';

import { useState } from 'react';

import { useCopyToClipboard } from '@/lib/core/hooks/use-copy-to-clipboard';
import { convertJsonToCsv } from '@/lib/modules/converters/json-to-csv';
import { Card } from '@/view/ui/Card';

import { ResultViewer } from './text/ResultViewer';

export function JsonToCsvConverter() {
  const [jsonInput, setJsonInput] = useState('');
  const [csvOutput, setCsvOutput] = useState('');
  const [error, setError] = useState('');

  const { isCopied, copy } = useCopyToClipboard();

  const handleConvert = () => {
    try {
      setError('');
      const result = convertJsonToCsv(jsonInput);
      setCsvOutput(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка конвертации');
      setCsvOutput('');
    }
  };

  const handleClear = () => {
    setJsonInput('');
    setCsvOutput('');
    setError('');
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Input */}
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                JSON Input
              </label>
              <button
                onClick={handleClear}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Очистить
              </button>
            </div>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              onBlur={handleConvert}
              placeholder='[{"name": "John", "age": 30}, {"name": "Jane", "age": 25}]'
              className="h-64 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
                {error}
              </div>
            )}
            <button
              onClick={handleConvert}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Конвертировать
            </button>
          </div>
        </Card>

        {/* Output - Используем новый Кристалл */}
        <ResultViewer
          title="CSV Output"
          value={csvOutput}
          isCopied={isCopied}
          onCopy={copy}
          className="h-[400px] md:h-auto"
        />
      </div>

      {/* Example */}
      <Card title="Пример использования">
        <div className="space-y-3 text-sm">
          <div>
            <p className="mb-1 text-zinc-600 dark:text-zinc-400">JSON:</p>
            <pre className="rounded-md bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-800">
              {`[
  {"name": "Иван", "age": 30, "city": "Москва"},
  {"name": "Мария", "age": 25, "city": "СПб"}
]`}
            </pre>
          </div>
          <div>
            <p className="mb-1 text-zinc-600 dark:text-zinc-400">CSV:</p>
            <pre className="rounded-md bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-800">
              {`name,age,city
Иван,30,Москва
Мария,25,СПб`}
            </pre>
          </div>
        </div>
      </Card>
    </div>
  );
}
