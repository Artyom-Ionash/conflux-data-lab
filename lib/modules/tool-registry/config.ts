import type { ToolConfig } from './types';

// Порядок ключей определяет порядок отображения категорий на странице
export const categoryLabels: Record<string, string> = {
  sprites: 'Таблицы спрайтов',
  conversion: 'Конвертация',
  analysis: 'Анализ данных',
  formatting: 'Форматирование',
  transformation: 'Трансформация',
  validation: 'Валидация',
};

export const tools: ToolConfig[] = [
  // --- SPRITES TOOLS ---
  {
    id: 'video-frame-extractor',
    name: 'Video Frame Extractor',
    description: 'Extract frames from video, create spritesheets and analyze differences.',
    category: 'sprites', // Обновлена категория
    tags: ['video', 'frames', 'spritesheet', 'gif'],
    featured: true,
  },
  {
    id: 'vertical-image-aligner',
    name: 'Vertical Image Aligner',
    description: 'Stack images vertically with equal width scaling.',
    category: 'sprites', // Обновлена категория
    tags: ['image', 'align', 'spritesheet'],
  },
  {
    id: 'monochrome-background-remover',
    name: 'Monochrome Remover',
    description: 'Remove background from monochrome images using luminance.',
    category: 'sprites', // Обновлена категория
    tags: ['image', 'transparent', 'spritesheet'],
  },

  // --- CONVERSION TOOLS ---
  {
    id: 'project-to-context',
    name: 'Project to LLM Context',
    description:
      'Convert a code project folder into a single Markdown file for LLM context (Godot, Next.js, etc).',
    category: 'conversion',
    tags: ['llm', 'context', 'markdown', 'code', 'godot'],
    featured: true,
  },
  {
    id: 'json-to-csv',
    name: 'JSON to CSV',
    description: 'Convert JSON data to CSV format with flattening support.',
    category: 'conversion',
    tags: ['json', 'csv', 'converter', 'developer'],
  },
];

export const toolsByCategory = tools.reduce(
  (acc, tool) => {
    const category = tool.category;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(tool);
    return acc;
  },
  {} as Record<string, ToolConfig[]>
);

export function getToolById(id: string): ToolConfig | undefined {
  return tools.find((tool) => tool.id === id);
}
