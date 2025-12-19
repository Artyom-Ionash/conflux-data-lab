/* eslint-disable react-hooks/static-components */
import { notFound } from 'next/navigation';

import { getToolById } from '@/lib/core/registry/config';
import { getToolComponent } from '@/view/shell/registry/tool-loader';

interface ToolPageProps {
  params: Promise<{
    category: string;
    toolId: string;
  }>;
}

export default async function ToolPage({ params }: ToolPageProps) {
  const { toolId } = await params;
  const tool = getToolById(toolId);

  if (!tool) {
    notFound();
  }

  const ToolComponent = getToolComponent(toolId);

  return (
    <div className="flex h-full w-full flex-col bg-zinc-50 dark:bg-zinc-950">
      {ToolComponent ? (
        <ToolComponent />
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-600 dark:text-zinc-400">Загрузка компонента...</p>
        </div>
      )}
    </div>
  );
}
