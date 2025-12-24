'use client';

import type { DragEndEvent, UniqueIdentifier } from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
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
import React, { useId } from 'react';

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
    zIndex: isDragging ? 'var(--z-overlay)' : 'auto',
    position: 'relative' as const,
  };
  // attributes + listeners формируют props для div-а или другого HTML элемента
  const dragProps = { ...attributes, ...listeners } as React.HTMLAttributes<HTMLElement>;

  return (
    <div ref={setNodeRef} style={style} className={cn(className, isDragging && 'z-overlay')}>
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      onReorder(arrayMove(items, oldIndex, newIndex));
    }
  };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
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
    </DndContext>
  );
}
