import { pipe } from 'remeda';

// --- Helpers (Pure Functions) ---

const parseJson = (input: string): unknown => {
  if (!input.trim()) return [];
  return JSON.parse(input);
};

const validateArray = (data: unknown): Record<string, unknown>[] => {
  if (!Array.isArray(data)) {
    throw new Error('JSON должен быть массивом объектов');
  }
  return data as Record<string, unknown>[];
};

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  const stringValue = String(value);
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
};

const generateCsvString = (data: Record<string, unknown>[]): string => {
  if (data.length === 0) return '';

  // Берем заголовки из первого объекта
  const headers = Object.keys(data[0] || {});

  const headerRow = headers.join(',');

  const bodyRows = data.map((row) =>
    headers.map((fieldName) => escapeCsvValue(row[fieldName])).join(',')
  );

  return [headerRow, ...bodyRows].join('\n');
};

// --- Main Pipeline ---

export function convertJsonToCsv(input: string): string {
  return pipe(input, parseJson, validateArray, generateCsvString);
}
