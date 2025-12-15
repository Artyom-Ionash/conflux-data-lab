'use client';

import { useState } from 'react';

import { Card } from '../../primitives/Card';

export function JsonToCsvConverter() {
  const [jsonInput, setJsonInput] = useState('');
  const [csvOutput, setCsvOutput] = useState('');
  const [error, setError] = useState('');

  const convert = () => {
    try {
      setError('');

      if (!jsonInput.trim()) {
        setCsvOutput('');
        return;
      }

      const data = JSON.parse(jsonInput);

      if (!Array.isArray(data)) {
        throw new Error('JSON должен быть массивом объектов');
      }

      if (data.length === 0) {
        setCsvOutput('');
        return;
      }

      // Получаем заголовки из первого объекта
      const headers = Object.keys(data[0]);

      // Создаем CSV строки
      const csvRows = [
        headers.join(','), // заголовки
        ...data.map((row) =>
          headers
            .map((header) => {
              const value = row[header];
              // Экранируем кавычки и запятые
              if (value === null || value === undefined) {
                return '';
              }
              const stringValue = String(value);
              if (
                stringValue.includes(',') ||
                stringValue.includes('"') ||
                stringValue.includes('\n')
              ) {
                return `"${stringValue.replaceAll('"', '""')}"`;
              }
              return stringValue;
            })
            .join(',')
        ),
      ];

      setCsvOutput(csvRows.join('\n'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка конвертации');
      setCsvOutput('');
    }
  };

  const handleCopy = () => {
    void navigator.clipboard.writeText(csvOutput);
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
              onBlur={convert}
              placeholder='[{"name": "John", "age": 30}, {"name": "Jane", "age": 25}]'
              className="h-64 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
                {error}
              </div>
            )}
            <button
              onClick={convert}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Конвертировать
            </button>
          </div>
        </Card>

        {/* Output */}
        <Card>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                CSV Output
              </label>
              {csvOutput && (
                <button
                  onClick={handleCopy}
                  className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Копировать
                </button>
              )}
            </div>
            <textarea
              value={csvOutput}
              readOnly
              placeholder="Результат конвертации появится здесь..."
              className="h-64 w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </Card>
      </div>

      {/* Example */}
      <Card>
        <h3 className="mb-3 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Пример использования
        </h3>
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
