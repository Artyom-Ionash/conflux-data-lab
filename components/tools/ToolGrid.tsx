// 1. Импортируем ToolConfig вместо Tool
import type { ToolConfig } from '@/lib/modules/tool-registry/types';

import { ToolCard } from './ToolCard';

interface ToolGridProps {
  // 2. Указываем правильный тип массива
  tools: ToolConfig[];
}

export function ToolGrid({ tools }: ToolGridProps) {
  if (tools.length === 0) {
    return (
      <div className="py-12 text-center text-zinc-500 dark:text-zinc-400">
        Инструменты не найдены
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}
