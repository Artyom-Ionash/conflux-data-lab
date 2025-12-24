'use client';

import type { DragEndEvent, DragStartEvent, UniqueIdentifier } from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import React, { useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/core/tailwind/utils';

// --- Types ---

interface Identifiable {
  id: UniqueIdentifier;
}

interface SortableListProps<T extends Identifiable> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (
    item: T,
    index: number,
    isDragging: boolean,
    dragProps: React.HTMLAttributes<HTMLElement>
  ) => React.ReactNode;
  className?: string;
  itemClassName?: string;
}

// --- Internal Item Wrapper ---

interface SortableItemWrapperProps {
  id: UniqueIdentifier;
  children: (isDragging: boolean, props: React.HTMLAttributes<HTMLElement>) => React.ReactNode;
  className?: string | undefined;
}

function SortableItemWrapper({ id, children, className }: SortableItemWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Просто делаем его полупрозрачным.
    opacity: isDragging ? 0.3 : 1,
    position: 'relative' as const,
    touchAction: 'none',
  };

  const dragProps = { ...attributes, ...listeners } as React.HTMLAttributes<HTMLElement>;

  return (
    <div ref={setNodeRef} style={style} className={className}>
      {children(isDragging, dragProps)}
    </div>
  );
}

// --- Main Component ---

export function SortableList<T extends Identifiable>({
  items,
  onReorder,
  renderItem,
  className,
  itemClassName,
}: SortableListProps<T>) {
  const dndId = useId();
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [mounted, setMounted] = useState(false);

  // Hydration fix для портала
  React.useEffect(() => setMounted(true), []);

  // Находим активный элемент для отображения в портале
  const activeItem = useMemo(() => items.find((i) => i.id === activeId), [activeId, items]);
  const activeIndex = useMemo(() => items.findIndex((i) => i.id === activeId), [activeId, items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={cn('flex flex-col gap-1', className)}>
          {items.map((item, index) => (
            <SortableItemWrapper key={item.id} id={item.id} className={itemClassName}>
              {(isDragging, dragProps) => renderItem(item, index, isDragging, dragProps)}
            </SortableItemWrapper>
          ))}
        </div>
      </SortableContext>

      {/* 
         ПОРТАЛ (Drag Overlay): 
         Элемент рендерится в body, избегая overflow:hidden родителя.
         Используем z-cursor.
      */}
      {mounted &&
        createPortal(
          <DragOverlay
            style={{ zIndex: 'var(--z-cursor)' }}
            dropAnimation={{
              duration: 200,
              easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
            }}
          >
            {activeItem ? (
              // Рендерим копию элемента для перетаскивания.
              // isDragging=true передаем для стилизации (например, рамки),
              // но dragProps пустые, так как оверлей сам следует за мышью.
              <div
                className={cn(
                  itemClassName,
                  'scale-105 cursor-grabbing opacity-90 shadow-2xl ring-1 ring-blue-500/50'
                )}
              >
                {renderItem(activeItem, activeIndex, true, {})}
              </div>
            ) : null}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );
}
