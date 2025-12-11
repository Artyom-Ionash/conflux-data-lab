/**
 * Утилита для динамической загрузки компонентов инструментов.
 * Использует Code Splitting для предотвращения загрузки кода всех инструментов сразу.
 */

import dynamic from 'next/dynamic';
import React from 'react';

// Заглушка загрузки (Skeleton), пока подгружается JS-бандл инструмента
const ToolLoading = () => (
  <div className="flex h-[50vh] w-full flex-col items-center justify-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-8 dark:border-zinc-800 dark:bg-zinc-900/50">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600 dark:border-zinc-700" />
    <p className="animate-pulse text-sm font-medium text-zinc-500 dark:text-zinc-400">
      Загрузка инструмента...
    </p>
  </div>
);

// --- Dynamic Imports ---
// Важно: так как компоненты используют named exports, мы используем .then(mod => mod.Component)

const JsonToCsvConverter = dynamic(
  () =>
    import('@/app/components/tools/json-to-csv/JsonToCsvConverter').then(
      (mod) => mod.JsonToCsvConverter
    ),
  { loading: ToolLoading }
);

const VideoFrameExtractor = dynamic(
  () =>
    import('@/app/components/tools/video-frame-extractor/VideoFrameExtractor').then(
      (mod) => mod.VideoFrameExtractor
    ),
  { loading: ToolLoading }
);

const VerticalImageAligner = dynamic(
  () =>
    import('@/app/components/tools/vertical-aligner/VerticalImageAligner').then(
      (mod) => mod.VerticalImageAligner
    ),
  { loading: ToolLoading }
);

const MonochromeBackgroundRemover = dynamic(
  () =>
    import('@/app/components/tools/monochrome-remover/MonochromeBackgroundRemover').then(
      (mod) => mod.MonochromeBackgroundRemover
    ),
  { loading: ToolLoading }
);

const ProjectToContext = dynamic(
  () =>
    import('@/app/components/tools/project-to-context/ProjectToContext').then(
      (mod) => mod.ProjectToContext
    ),
  { loading: ToolLoading }
);

// --- Registry ---

const toolComponents: Record<string, React.ComponentType> = {
  'json-to-csv': JsonToCsvConverter,
  'video-frame-extractor': VideoFrameExtractor,
  'vertical-image-aligner': VerticalImageAligner,
  'monochrome-background-remover': MonochromeBackgroundRemover,
  'project-to-context': ProjectToContext,
  // Новые инструменты регистрируйте здесь аналогичным образом через dynamic()
};

export function getToolComponent(toolId: string): React.ComponentType | null {
  return toolComponents[toolId] || null;
}
