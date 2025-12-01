/**
 * Конфигурация всех инструментов портфолио
 */

import { Tool, ToolConfig } from '@/lib/types/tools';

export const tools: Tool[] = [
  {
    id: 'json-to-csv',
    name: 'JSON to CSV',
    description: 'Конвертация JSON данных в CSV формат',
    category: 'conversion',
    tags: ['json', 'csv', 'conversion', 'data'],
    featured: true,
  },
  {
    id: 'csv-to-json',
    name: 'CSV to JSON',
    description: 'Конвертация CSV файлов в JSON формат',
    category: 'conversion',
    tags: ['csv', 'json', 'conversion', 'data'],
    featured: true,
  },
  {
    id: 'xml-to-json',
    name: 'XML to JSON',
    description: 'Преобразование XML в JSON структуру',
    category: 'conversion',
    tags: ['xml', 'json', 'conversion'],
  },
  {
    id: 'json-formatter',
    name: 'JSON Formatter',
    description: 'Форматирование и валидация JSON',
    category: 'formatting',
    tags: ['json', 'formatting', 'validation'],
  },
  {
    id: 'base64-encoder',
    name: 'Base64 Encoder/Decoder',
    description: 'Кодирование и декодирование Base64',
    category: 'conversion',
    tags: ['base64', 'encoding', 'decoding'],
  },
];

export const toolsByCategory = tools.reduce((acc, tool) => {
  if (!acc[tool.category]) {
    acc[tool.category] = [];
  }
  acc[tool.category].push(tool);
  return acc;
}, {} as Record<string, Tool[]>);

export const categoryLabels: Record<string, string> = {
  conversion: 'Конвертация',
  transformation: 'Трансформация',
  analysis: 'Анализ',
  validation: 'Валидация',
  formatting: 'Форматирование',
};

export function getToolById(id: string): Tool | undefined {
  return tools.find(tool => tool.id === id);
}


