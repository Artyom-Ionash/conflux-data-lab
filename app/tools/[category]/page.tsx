import Link from 'next/link';
import { notFound } from 'next/navigation';

import { categoryLabels,toolsByCategory } from '@/lib/config/tools';

import { ToolGrid } from '../../components/tools/ToolGrid';

interface CategoryPageProps {
  params: Promise<{
    category: string;
  }>;
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category } = await params;
  const tools = toolsByCategory[category];

  if (!tools || tools.length === 0) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
          Главная
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-900 dark:text-zinc-100">
          {categoryLabels[category] || category}
        </span>
      </nav>

      {/* Category Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-zinc-100">
          {categoryLabels[category] || category}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {tools.length} {tools.length === 1 ? 'инструмент' : 'инструментов'}
        </p>
      </div>

      {/* Tools Grid */}
      <ToolGrid tools={tools} />
    </div>
  );
}

