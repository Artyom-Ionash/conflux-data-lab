import Link from 'next/link';

import type { ToolConfig } from '@/app/registry/specifications';
import { Card } from '@/ui/container/Card';
import { Badge } from '@/ui/primitive/Badge';

interface ToolCardProps {
  tool: ToolConfig;
}

export function ToolCard({ tool }: ToolCardProps) {
  return (
    <Card asChild className="h-full">
      <Link href={`/tools/${tool.category}/${tool.id}`} className="flex flex-col">
        {/* Внутренний паддинг теперь задаем здесь или используем дефолтный стиль Card, если бы он не был Slot */}
        <div className="flex flex-1 flex-col gap-3 p-6">
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{tool.name}</h3>
            {tool.featured && <Badge variant="primary">Featured</Badge>}
          </div>
          <p className="flex-1 text-sm text-zinc-600 dark:text-zinc-400">{tool.description}</p>
          <div className="flex flex-wrap gap-1.5">
            {tool.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="default">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </Link>
    </Card>
  );
}
