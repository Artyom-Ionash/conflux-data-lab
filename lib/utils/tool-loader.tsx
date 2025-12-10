/**
 * Утилита для динамической загрузки компонентов инструментов
 */

import { JsonToCsvConverter } from '@/app/components/tools/json-to-csv/JsonToCsvConverter';
import { MonochromeBackgroundRemover } from '@/app/components/tools/monochrome-remover/MonochromeBackgroundRemover';
import { ProjectToContext } from '@/app/components/tools/project-to-context/ProjectToContext';
import { VerticalImageAligner } from '@/app/components/tools/vertical-aligner/VerticalImageAligner';
import { VideoFrameExtractor } from '@/app/components/tools/video-frame-extractor/VideoFrameExtractor';

const toolComponents: Record<string, React.ComponentType> = {
  'json-to-csv': JsonToCsvConverter,
  'video-frame-extractor': VideoFrameExtractor,
  'vertical-image-aligner': VerticalImageAligner,
  'monochrome-background-remover': MonochromeBackgroundRemover,
  'project-to-context': ProjectToContext,
  // Добавьте здесь другие компоненты инструментов
};

export function getToolComponent(toolId: string): React.ComponentType | null {
  return toolComponents[toolId] || null;
}