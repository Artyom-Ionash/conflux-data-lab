import { useCallback, useState } from 'react';

/**
 * Хук для реализации сортировки списка методом Drag-and-Drop.
 */
export function useDraggableList<T>(
  items: T[],
  setItems: React.Dispatch<React.SetStateAction<T[]>>
) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    setDraggingIndex(index);
    // Необходимо для Firefox
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (draggingIndex === null || draggingIndex === targetIndex) {
        setDraggingIndex(null);
        return;
      }

      setItems((prev) => {
        const copy = [...prev];
        const [item] = copy.splice(draggingIndex, 1);
        copy.splice(targetIndex, 0, item);
        return copy;
      });
      setDraggingIndex(null);
    },
    [draggingIndex, setItems]
  );

  return {
    draggingIndex,
    handleDragStart,
    handleDragOver,
    handleDrop,
  };
}
