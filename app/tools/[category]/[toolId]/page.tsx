/* eslint-disable react-hooks/static-components */
import { notFound } from 'next/navigation';

import { getToolComponent } from '@/app/_components/registry/tool-loader';
import { getToolById } from '@/lib/core/registry/config';

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

  // ИЗМЕНЕНИЕ: Убраны классы container, mx-auto, padding.
  // Теперь компонент занимает всю ширину и высоту родителя (main).
  return (
    <div className="flex h-full w-full flex-col bg-zinc-50 dark:bg-zinc-950">
      {ToolComponent ? (
        <ToolComponent />
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-zinc-500">Загрузка инструмента...</p>
        </div>
      )}
    </div>
  );
}
