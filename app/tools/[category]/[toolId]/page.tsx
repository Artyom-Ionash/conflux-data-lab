/* eslint-disable react-hooks/static-components */
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { categoryLabels, getToolById } from '@/lib/core/registry/config';
import { getToolComponent } from '@/view/shell/registry/tool-loader';
import { Badge } from '@/view/ui/Badge';

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

  // FIX: Удален container и отступы.
  // Используем flex-col h-full, чтобы занять всё пространство, предоставленное лейаутом (или Workbench).
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
