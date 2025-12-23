import { useEffect, useRef } from 'react';

/**
 * Хук для выполнения эффекта с задержкой (debounce).
 * Идеально подходит для слайдеров, ввода текста или тяжелых вычислений,
 * которые не должны запускаться на каждый чих.
 *
 * @param effect Функция-эффект, которую нужно выполнить.
 * @param deps Массив зависимостей (как в useEffect).
 * @param delay Задержка в миллисекундах.
 */
export function useDebounceEffect(effect: () => void, deps: React.DependencyList, delay: number) {
  // Используем ref для хранения актуальной функции эффекта,
  // чтобы не пересоздавать таймер, если меняется сама функция, но не зависимости.
  const callback = useRef(effect);

  useEffect(() => {
    callback.current = effect;
  }, [effect]);

  useEffect(() => {
    const handler = setTimeout(() => {
      callback.current();
    }, delay);

    return () => {
      clearTimeout(handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}
