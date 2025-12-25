'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type TaskStatus = 'idle' | 'running' | 'success' | 'error';

export interface TaskState<T, E = Error> {
  status: TaskStatus;
  result: T | null;
  error: E | null;
  progress: number;
}

// Контекст, который передается внутрь функции задачи
export interface TaskScope {
  signal: AbortSignal;
  setProgress: (percent: number) => void;
}

/**
 * Контроллер асинхронных задач.
 *
 * Особенности:
 * 1. Stable Identity: функция run стабильна.
 * 2. Auto-cleanup: отменяет задачу при размонтировании.
 * 3. Race Protection: гарантирует, что только последний вызов обновит стейт.
 * 4. Dependency Injection: signal и setProgress приходят аргументами.
 */
export function useTask<T, Args extends unknown[], E = Error>(
  taskFn: (scope: TaskScope, ...args: Args) => Promise<T>
) {
  const [state, setState] = useState<TaskState<T, E>>({
    status: 'idle',
    result: null,
    error: null,
    progress: 0,
  });

  const taskFnRef = useRef(taskFn);

  useEffect(() => {
    taskFnRef.current = taskFn;
  }, [taskFn]);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Стабильная функция обновления прогресса
  const updateProgress = useCallback((p: number) => {
    setState((prev) => ({ ...prev, progress: p }));
  }, []);

  const run = useCallback(
    async (...args: Args): Promise<T | null> => {
      // Race Condition Protection
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setState((prev) => ({
        ...prev,
        status: 'running',
        error: null,
        progress: 0,
      }));

      try {
        const result = await taskFnRef.current(
          {
            signal: controller.signal,
            setProgress: updateProgress,
          },
          ...args
        );

        if (controller.signal.aborted) return null;

        setState({
          status: 'success',
          result,
          error: null,
          progress: 100,
        });

        return result;
      } catch (err) {
        // Игнорируем штатную отмену
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }

        // Обновляем ошибку только если это актуальный контроллер
        if (abortControllerRef.current === controller) {
          setState({
            status: 'error',
            result: null,
            error: err as E,
            progress: 0,
          });
        }

        return null;
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
      }
    },
    [updateProgress]
  );

  const reset = useCallback(() => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setState({ status: 'idle', result: null, error: null, progress: 0 });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  return {
    ...state,
    run,
    reset,
    setProgress: updateProgress,
    isRunning: state.status === 'running',
    isError: state.status === 'error',
    isSuccess: state.status === 'success',
  };
}
