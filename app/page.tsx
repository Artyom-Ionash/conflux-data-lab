import { categoryLabels, TOOLS_MANIFEST, toolsByCategory } from '@/lib/core/registry/config';
import { ToolGrid } from '@/view/catalog/ToolGrid';
import { Badge } from '@/view/ui/Badge';

export default function Home() {
  const featuredTools = TOOLS_MANIFEST.filter((tool) => tool.featured);
  const categories = Object.keys(toolsByCategory);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <section className="mb-12 text-center">
        <h1 className="mb-4 text-4xl font-bold text-zinc-900 sm:text-5xl dark:text-zinc-100">
          Conflux Data Lab
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Коллекция инструментов для конвертации, трансформации и обработки данных. Удобные и
          быстрые решения для работы с различными форматами данных.
        </p>
      </section>

      {/* Featured Tools */}
      {featuredTools.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-6 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Рекомендуемые инструменты
          </h2>
          <ToolGrid tools={featuredTools} />
        </section>
      )}

      {/* Tools by Category */}
      {categories.map((category) => {
        // FIX: Явно получаем массив или пустой список
        const categoryTools = toolsByCategory[category] ?? [];

        return (
          <section key={category} className="mb-12">
            <div className="mb-6 flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {categoryLabels[category] || category}
              </h2>
              {/* FIX: categoryTools гарантированно массив */}
              <Badge variant="secondary">{categoryTools.length}</Badge>
            </div>
            <ToolGrid tools={categoryTools} />
          </section>
        );
      })}

      {/* All Tools Count */}
      <section className="mt-12 rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-zinc-600 dark:text-zinc-400">
          Всего инструментов:{' '}
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
            {TOOLS_MANIFEST.length}
          </span>
        </p>
      </section>
    </div>
  );
}
