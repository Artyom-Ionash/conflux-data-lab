# Conflux Data Lab

Портфолио инструментов для обработки и конвертации данных.

## Структура проекта

```
conflux-data-lab/
├── app/
│   ├── components/
│   │   ├── layout/          # Компоненты макета (Header, Footer)
│   │   ├── tools/           # Компоненты инструментов
│   │   │   ├── ToolCard.tsx
│   │   │   ├── ToolGrid.tsx
│   │   │   └── [tool-id]/   # Компоненты конкретных инструментов
│   │   └── ui/              # Переиспользуемые UI компоненты
│   ├── tools/
│   │   └── [category]/
│   │       ├── page.tsx     # Страница категории
│   │       └── [toolId]/
│   │           └── page.tsx # Страница инструмента
│   ├── layout.tsx           # Корневой layout
│   └── page.tsx             # Главная страница
├── lib/
│   ├── config/
│   │   └── tools.ts         # Конфигурация всех инструментов
│   ├── types/
│   │   └── tools.ts         # TypeScript типы
│   └── utils/
│       └── tool-loader.tsx  # Загрузчик компонентов инструментов
└── public/                   # Статические файлы
```

## Добавление нового инструмента

1. **Добавьте инструмент в конфигурацию** (`lib/config/tools.ts`):
```typescript
{
  id: 'my-tool',
  name: 'My Tool',
  description: 'Описание инструмента',
  category: 'conversion',
  tags: ['tag1', 'tag2'],
}
```

2. **Создайте компонент инструмента** (`app/components/tools/my-tool/MyTool.tsx`):
```typescript
'use client';

export function MyTool() {
  // Ваша логика инструмента
  return <div>...</div>;
}
```

3. **Зарегистрируйте компонент** (`lib/utils/tool-loader.tsx`):
```typescript
import { MyTool } from '@/app/components/tools/my-tool/MyTool';

const toolComponents: Record<string, React.ComponentType> = {
  'my-tool': MyTool,
  // ...
};
```

## Категории инструментов

- **conversion** - Конвертация данных (JSON ↔ CSV, XML ↔ JSON и т.д.)
- **transformation** - Трансформация данных
- **analysis** - Анализ данных
- **validation** - Валидация данных
- **formatting** - Форматирование данных

## Технологии

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS

## Запуск проекта

```bash
npm install
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.
