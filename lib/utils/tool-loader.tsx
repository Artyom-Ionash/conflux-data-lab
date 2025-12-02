/**
 * Утилита для динамической загрузки компонентов инструментов
 */

import { JsonToCsvConverter } from '../../app/components/tools/json-to-csv/JsonToCsvConverter';
import { VideoFrameExtractor } from '../../app/components/tools/video-frame-extractor/VideoFrameExtractor';
import { VerticalImageAligner } from '../../app/components/tools/vertical-image-aligner/VerticalImageAligner';

const toolComponents: Record<string, React.ComponentType> = {
  'json-to-csv': JsonToCsvConverter,
  'video-frame-extractor': VideoFrameExtractor,
  'vertical-image-aligner': VerticalImageAligner,
  // Добавьте здесь другие компоненты инструментов
  // 'csv-to-json': CsvToJsonConverter,
  // 'xml-to-json': XmlToJsonConverter,
};

export function getToolComponent(toolId: string): React.ComponentType | null {
  return toolComponents[toolId] || null;
}

