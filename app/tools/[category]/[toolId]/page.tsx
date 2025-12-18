/* eslint-disable react-hooks/static-components */
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { categoryLabels, getToolById } from '@/lib/modules/tool-registry/config';
import { getToolComponent } from '@/lib/modules/tool-registry/loader';
import { Badge } from '@/ui/Badge';

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

  // getToolComponent returns a stable reference from registry; suppress static component lint.

  const ToolComponent = getToolComponent(toolId);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Главная
        </Link>
        <span className="mx-2">/</span>
        <Link
          href={`/tools/${tool.category}`}
          className="hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {categoryLabels[tool.category]}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900 dark:text-zinc-100">{tool.name}</span>
      </nav>

      {/* Tool Header */}
      <div className="mb-8">
        <div className="mb-4 flex items-center gap-3">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{tool.name}</h1>
          {tool.featured && <Badge variant="primary">Featured</Badge>}
        </div>
        <p className="mb-4 text-lg text-zinc-600 dark:text-zinc-400">{tool.description}</p>
        <div className="flex flex-wrap gap-2">
          {tool.tags.map((tag) => (
            <Badge key={tag} variant="default">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Tool Content Area */}
      {ToolComponent ? (
        <ToolComponent />
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-zinc-600 dark:text-zinc-400">
            Компонент для этого инструмента еще не реализован. Создайте компонент в{' '}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
              app/components/tools/{toolId}/
            </code>{' '}
            и добавьте его в{' '}
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm dark:bg-zinc-800">
              lib/utils/tool-loader.tsx
            </code>
          </p>
        </div>
      )}
    </div>
  );
}
