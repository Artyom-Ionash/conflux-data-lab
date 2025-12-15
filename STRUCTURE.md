# Структура проекта Conflux Data Lab

Этот файл описывает **фактическую структуру файлов** проекта. Архитектурные принципы см. в `ARCHITECTURE.md`, общий обзор — в `README.md`.

> ⚠️ **Этот файл генерируется автоматически при коммите.** Не редактируйте вручную!
>
> Для настройки генератора см. `scripts/update-structure.mjs` и `scripts/structure-config.mjs`

```
conflux-data-lab/
│
├── app/ # Next.js App Router
│   ├── components/
│   │   ├── entities/
│   │   │   ├── hardware/
│   │   │   │   ├── TextureDimensionSlider.tsx
│   │   │   │   └── TextureLimitIndicator.tsx
│   │   │   └── video/
│   │   │       ├── analysis/
│   │   │       │   └── FrameDiffOverlay.tsx
│   │   │       ├── player/
│   │   │       │   └── RangeVideoPlayer.tsx
│   │   │       ├── DualHoverPreview.tsx
│   │   │       ├── MultiScalePreview.tsx
│   │   │       └── SpriteFrameList.tsx
│   │   ├── layout/
│   │   │   ├── Footer.tsx
│   │   │   └── Header.tsx
│   │   ├── primitives/
│   │   │   ├── Badge.tsx
│   │   │   ├── Canvas.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Checkerboard.tsx
│   │   │   ├── ColorInput.tsx
│   │   │   ├── ControlSection.tsx
│   │   │   ├── FileDropzone.tsx
│   │   │   ├── ImageSequencePlayer.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── NumberStepper.tsx
│   │   │   ├── ProcessingOverlay.tsx
│   │   │   ├── RangeSlider.tsx
│   │   │   ├── Slider.tsx
│   │   │   ├── Switch.tsx
│   │   │   ├── ToggleGroup.tsx
│   │   │   └── ZoneIndicator.tsx
│   │   └── tools/
│   │       ├── json-to-csv/
│   │       │   └── JsonToCsvConverter.tsx
│   │       ├── monochrome-remover/
│   │       │   └── MonochromeBackgroundRemover.tsx
│   │       ├── project-to-context/
│   │       │   └── ProjectToContext.tsx
│   │       ├── vertical-aligner/
│   │       │   └── VerticalImageAligner.tsx
│   │       ├── video-frame-extractor/
│   │       │   └── VideoFrameExtractor.tsx
│   │       ├── ToolCard.tsx
│   │       ├── ToolGrid.tsx
│   │       └── ToolLayout.tsx
│   ├── about/
│   │   └── page.tsx
│   ├── tools/
│   │   └── [category]/
│   │       ├── [toolId]/
│   │       │   └── page.tsx
│   │       └── page.tsx
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/ # Библиотека и утилиты
│   ├── types/
│   │   └── gifshot.d.ts
│   ├── core/
│   │   ├── utils/
│   │   │   ├── colors.ts
│   │   │   └── media.ts
│   │   └── hooks/
│   │       └── use-object-url.ts
│   └── modules/
│       ├── file-system/
│       │   ├── godot-scene.ts
│       │   └── tree-view.ts
│       ├── graphics/
│       │   ├── processing/
│       │   │   ├── filters.ts
│       │   │   ├── processor.worker.ts
│       │   │   └── sprite-generator.ts
│       │   └── standards.ts
│       └── tool-registry/
│           ├── config.ts
│           ├── loader.tsx
│           └── types.ts
├── public/ # Статические файлы
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── README.md # Основная документация
├── ARCHITECTURE.md # Описание архитектуры
├── STRUCTURE.md # Структура файлов (автогенерируется)
├── package.json # Конфигурация npm
├── tsconfig.json # Конфигурация TypeScript
├── next.config.ts # Конфигурация Next.js
├── .prettierrc
├── scripts/ # Вспомогательные скрипты
│   └── structure/
│       ├── config.mjs
│       └── update.mjs
├── eslint.config.mjs # Конфигурация ESLint
├── next-env.d.ts
├── package-lock.json
├── postcss.config.mjs # Конфигурация PostCSS
├── stylelint.config.mjs
└── TECH_DEBT.md
```

## Ключевые особенности структуры

### 1. Модульность

- Каждый инструмент - независимый компонент
- Легко добавлять/удалять инструменты
- Переиспользуемые UI компоненты

### 2. Типобезопасность

- Все типы определены в `lib/types/`
- TypeScript проверяет корректность на этапе компиляции

### 3. Масштабируемость

- Новые инструменты добавляются в 3 шага:
  1. Конфигурация в `lib/config/tools.ts`
  2. Компонент в `app/components/tools/[tool-id]/`
  3. Регистрация в `lib/utils/tool-loader.tsx`

### 4. Организация по категориям

- Инструменты группируются по категориям
- URL структура: `/tools/[category]/[toolId]`
- Легкая навигация и фильтрация

## Примеры маршрутов

- `/` - Главная страница со всеми инструментами
- `/tools/conversion` - Все инструменты конвертации
- `/tools/conversion/json-to-csv` - Конкретный инструмент

## Следующие шаги

1. Добавьте больше инструментов в `lib/config/tools.ts`
2. Создайте компоненты для каждого инструмента
3. Зарегистрируйте компоненты в `lib/utils/tool-loader.tsx`
4. Настройте стили под ваш бренд
