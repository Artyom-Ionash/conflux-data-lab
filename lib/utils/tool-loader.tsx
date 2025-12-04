/**
 * Утилита для динамической загрузки компонентов инструментов
 */

import { JsonToCsvConverter } from '../../app/components/tools/json-to-csv/JsonToCsvConverter';
import { VideoFrameExtractor } from '../../app/components/tools/video-frame-extractor/VideoFrameExtractor';
import { VerticalImageAligner } from '../../app/components/tools/vertical-aligner/VerticalImageAligner';
import { MonochromeBackgroundRemover } from '../../app/components/tools/monochrome-remover/MonochromeBackgroundRemover';

const toolComponents: Record<string, React.ComponentType> = {
  'json-to-csv': JsonToCsvConverter,
  'video-frame-extractor': VideoFrameExtractor,
  'vertical-image-aligner': VerticalImageAligner,
  'monochrome-background-remover': MonochromeBackgroundRemover,
  // Добавьте здесь другие компоненты инструментов
  // 'csv-to-json': CsvToJsonConverter,
  // 'xml-to-json': XmlToJsonConverter,
};

export function getToolComponent(toolId: string): React.ComponentType | null {
  return toolComponents[toolId] || null;
}

