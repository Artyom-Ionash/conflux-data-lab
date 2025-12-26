import { useEffect, useRef, useState } from 'react';

export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  status: AsyncStatus;
  result: T | null;
  error: Error | null;
}

/**
 * Реактивный узел пайплайна.
 * Вычисляет `output` на основе `input` асинхронно.
 * Автоматически отменяет устаревшие вычисления при смене входных данных.
 *
 * @param input Входные данные. Если null, результат сбрасывается в idle.
 * @param transform Асинхронная функция трансформации. Принимает signal для отмены.
 * @param debounceMs Опциональная задержка перед началом вычислений (debounce).
 */
export function useAsyncDerived<I, O>(
  input: I | null,
  transform: (data: I, signal: AbortSignal) => Promise<O>,
  debounceMs = 0
): AsyncState<O> {
  const [state, setState] = useState<AsyncState<O>>({
    status: 'idle',
    result: null,
    error: null,
  });

  // Храним transform в ref, чтобы не триггерить эффект при пересоздании функции
  const transformRef = useRef(transform);
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const signal = controller.signal;
    let timerId: NodeJS.Timeout | null = null;
    let rafId: number | null = null;

    const run = async () => {
      // 1. Обработка сброса данных внутри асинхронного потока
      if (input === null) {
        if (isMounted) setState({ status: 'idle', result: null, error: null });
        return;
      }

      // 2. Индикация загрузки (перед началом работы)
      if (isMounted) setState((prev) => ({ ...prev, status: 'loading', error: null }));

      try {
        const result = await transformRef.current(input, signal);

        if (!signal.aborted && isMounted) {
          setState({ status: 'success', result, error: null });
        }
      } catch (err) {
        if (!signal.aborted && isMounted) {
          // Игнорируем ошибки отмены (AbortError), остальные записываем
          if (err instanceof Error && err.name === 'AbortError') return;

          setState({
            status: 'error',
            result: null,
            error: err instanceof Error ? err : new Error(String(err)),
          });
        }
      }
    };

    if (debounceMs > 0 && input !== null) {
      // FIX: Оборачиваем установку loading в requestAnimationFrame,
      // чтобы избежать ошибки "Calling setState synchronously within an effect".
      // Это переносит обновление на следующий кадр, не блокируя текущий рендер.
      rafId = requestAnimationFrame(() => {
        if (isMounted) setState((prev) => ({ ...prev, status: 'loading' }));
      });
      timerId = setTimeout(run, debounceMs);
    } else {
      void run();
    }

    // 3. Cleanup: Отмена при изменении input или размонтировании
    return () => {
      isMounted = false;
      controller.abort();
      if (timerId) clearTimeout(timerId);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [input, debounceMs]); // Зависимость только от данных

  return state;
}
