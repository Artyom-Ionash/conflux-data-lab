/**
 * Типы для системы инструментов портфолио
 */

export type ToolCategory =
  | 'sprites' // Таблицы спрайтов и графика
  | 'conversion' // Конвертация
  | 'transformation' // Трансформация
  | 'analysis' // Анализ
  | 'validation' // Валидация
  | 'formatting'; // Форматирование

export interface ToolConfig {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  tags: string[];

  // Опциональные поля
  featured?: boolean;
  icon?: string;

  // Метаданные для документации
  examples?: ToolExample[];

  // Специфично для конвертеров
  supportedFormats?: {
    input: string[];
    output: string[];
  };
}

export interface ToolExample {
  name: string;
  input: string;
  output: string;
  description?: string;
}
