'use client';

import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group';
import * as React from 'react';

// Хелпер для объединения классов
function cx(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

// --- Props ---

type ToggleGroupProps = React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> & {
  /** Количество колонок в сетке. Если указано, включается display: grid. */
  gridCols?: number;
};

type ToggleGroupItemProps = React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> & {
  /** Растянуть элемент на всю ширину сетки (col-span-full) */
  fullWidth?: boolean;
};

// --- Components ---

const ToggleGroup = React.forwardRef<
  HTMLDivElement,
  ToggleGroupProps
>(({ className, children, gridCols, style, ...props }, ref) => { // <-- Убрали onKeyDown отсюда

  const baseStyles = "bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg gap-1";
  const layoutStyles = gridCols ? "grid" : "inline-flex flex-row";

  const dynamicStyle: React.CSSProperties = gridCols
    ? {
      ...style,
      gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`
    }
    : style || {};

  return (
    <ToggleGroupPrimitive.Root
      ref={ref}
      className={cx(baseStyles, layoutStyles, className)}
      style={dynamicStyle}
      loop={true}
      {...props} // <-- Теперь onKeyDown (если есть) передан здесь
    >
      {children}
    </ToggleGroupPrimitive.Root>
  );
});

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName;

const ToggleGroupItem = React.forwardRef<
  HTMLButtonElement,
  ToggleGroupItemProps
>(({ className, children, fullWidth, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cx(
      // Базовая геометрия и фокус
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-xs font-medium ring-offset-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",

      // Цвета (неактивный / ховер)
      "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300",

      // Активное состояние (data-state=on)
      "data-[state=on]:bg-white data-[state=on]:text-zinc-950 data-[state=on]:shadow-sm",
      "dark:data-[state=on]:bg-zinc-700 dark:data-[state=on]:text-zinc-100",

      // Утилита для растягивания
      fullWidth ? "col-span-full" : undefined,

      className
    )}
    {...props}
  >
    {children}
  </ToggleGroupPrimitive.Item>
));

ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName;

export { ToggleGroup, ToggleGroupItem };