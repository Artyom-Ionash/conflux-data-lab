import { notFound } from 'next/navigation';

import { getToolById } from '@/lib/core/registry/inventory';
import { ToolRegistry } from '@/view/shell/registry/tool-loader';

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

  return (
    <div className="flex h-full w-full flex-col bg-zinc-50 dark:bg-zinc-950">
      <ToolRegistry toolId={toolId} />
    </div>
  );
}
