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

const ContextSculptor = dynamic(
  () => import('@/features/ContextSculptor').then((mod) => mod.ContextSculptor),
  { loading: ToolLoading }
);

const JsonToCsvConverter = dynamic(
  () => import('@/features/JsonToCsvConverter').then((mod) => mod.JsonToCsvConverter),
  { loading: ToolLoading }
);

const VideoFrameExtractor = dynamic(
  () => import('@/features/VideoFrameExtractor').then((mod) => mod.VideoFrameExtractor),
  { loading: ToolLoading }
);

const VerticalImageAligner = dynamic(
  () => import('@/features/VerticalImageAligner').then((mod) => mod.VerticalImageAligner),
  { loading: ToolLoading }
);

const MonochromeBackgroundRemover = dynamic(
  () =>
    import('@/features/MonochromeBackgroundRemover').then((mod) => mod.MonochromeBackgroundRemover),
  { loading: ToolLoading }
);

const ProjectToContext = dynamic(
  () => import('@/features/ProjectToContext').then((mod) => mod.ProjectToContext),
  { loading: ToolLoading }
);

// --- Registry ---

const toolComponents: Record<string, React.ComponentType> = {
  'context-sculptor': ContextSculptor,
  'json-to-csv': JsonToCsvConverter,
  'video-frame-extractor': VideoFrameExtractor,
  'vertical-image-aligner': VerticalImageAligner,
  'monochrome-background-remover': MonochromeBackgroundRemover,
  'project-to-context': ProjectToContext,
};

/**
 * Рендерит компонент инструмента по его ID.
 * Решает проблему линтера react-hooks/static-components, так как объявлен на верхнем уровне.
 */
export function ToolRegistry({ toolId }: { toolId: string }) {
  const Component = toolComponents[toolId];

  if (!Component) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-900/20">
        <p className="text-red-600 dark:text-red-400">
          Ошибка: Инструмент &quot;{toolId}&quot; не зарегистрирован в системе.
        </p>
      </div>
    );
  }

  return <Component />;
}

/**
 * Возвращает ссылку на компонент (для специфических нужд)
 */
export function getToolComponent(toolId: string): React.ComponentType | null {
  return toolComponents[toolId] || null;
}
