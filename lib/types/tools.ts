/**
 * Типы для системы инструментов портфолио
 */

export type ToolCategory = 
  | 'conversion'      // Конвертация данных
  | 'transformation'  // Трансформация данных
  | 'analysis'        // Анализ данных
  | 'validation'      // Валидация данных
  | 'formatting';     // Форматирование данных

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon?: string;
  tags: string[];
  featured?: boolean;
}

export interface ToolConfig {
  tool: Tool;
  component: string; // путь к компоненту
  examples?: ToolExample[];
}

export interface ToolExample {
  name: string;
  input: string;
  output: string;
  description?: string;
}

export interface ConversionTool extends Tool {
  category: 'conversion';
  supportedFormats: {
    input: string[];
    output: string[];
  };
}


