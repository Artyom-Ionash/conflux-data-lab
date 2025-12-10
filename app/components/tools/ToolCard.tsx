import { Tool } from '@/lib/types/tools';

import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';

interface ToolCardProps {
  tool: Tool;
}

export function ToolCard({ tool }: ToolCardProps) {
  return (
    <Card href={`/tools/${tool.category}/${tool.id}`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {tool.name}
          </h3>
          {tool.featured && (
            <Badge variant="primary">Featured</Badge>
          )}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {tool.description}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tool.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="default">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </Card>
  );
}

