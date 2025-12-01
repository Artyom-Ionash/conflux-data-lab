/**
 * Утилита для динамической загрузки компонентов инструментов
 */

import { JsonToCsvConverter } from '../../app/components/tools/json-to-csv/JsonToCsvConverter';

const toolComponents: Record<string, React.ComponentType> = {
  'json-to-csv': JsonToCsvConverter,
  // Добавьте здесь другие компоненты инструментов
  // 'csv-to-json': CsvToJsonConverter,
  // 'xml-to-json': XmlToJsonConverter,
};

export function getToolComponent(toolId: string): React.ComponentType | null {
  return toolComponents[toolId] || null;
}

