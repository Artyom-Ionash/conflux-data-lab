# Conflux Data Lab

Портфолио инструментов для обработки и конвертации данных.

## Документация

- `README.md` — краткий обзор проекта, запуск, категории инструментов
- `ARCHITECTURE.md` — архитектура, ключевые принципы и поток данных
- `STRUCTURE.md` — актуальная структура файлов и директорий
- `CHANGES_REVIEW.md` — сводка изменений текущей версии

## Структура проекта

Актуальное дерево директорий и пояснения см. в файле `STRUCTURE.md`. Ниже — укороченная схема:

```
conflux-data-lab/
├── app/                 # Приложение Next.js (страницы и компоненты)
├── lib/                 # Конфигурация, типы и утилиты
├── public/              # Статические файлы
└── *.md                 # Документация (этот файл, архитектура, структура и т.д.)
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

Более подробное описание процесса добавления нового инструмента и общих принципов архитектуры — в разделе «Добавление нового инструмента» файла `ARCHITECTURE.md`.

## Категории инструментов

- **conversion** — конвертация данных (JSON ↔ CSV, XML ↔ JSON и т.д.)
- **transformation** — трансформация данных
- **analysis** — анализ данных
- **validation** — валидация данных
- **formatting** — форматирование данных

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

Откройте `http://localhost:3000` в браузере.
