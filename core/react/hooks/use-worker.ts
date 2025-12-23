import { useCallback, useEffect, useRef, useState } from 'react';

interface WorkerOptions<Res> {
  /** Функция, создающая экземпляр Worker */
  workerFactory: () => Worker;
  /** Коллбек для обработки входящих сообщений от воркера */
  onMessage: (data: Res) => void;
  /** Коллбек для обработки ошибок воркера */
  onError?: (error: ErrorEvent) => void;
}

interface UseWorkerReturn<Req> {
  postMessage: (message: Req, transfer?: Transferable[]) => void;
  isReady: boolean;
  workerRef: React.MutableRefObject<Worker | null>;
}

/**
 * Хук для безопасного управления Web Worker.
 * Автоматически создает и уничтожает воркер, управляет подписками.
 */
export function useWorker<Req, Res>({
  workerFactory,
  onMessage,
  onError,
}: WorkerOptions<Res>): UseWorkerReturn<Req> {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Сохраняем коллбеки в ref, чтобы не пересоздавать воркер при их изменении
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onErrorRef.current = onError;
  }, [onMessage, onError]);

  useEffect(() => {
    // 1. Создаем воркер
    const worker = workerFactory();
    workerRef.current = worker;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReady(true);

    // 2. Подписываемся на события
    worker.onmessage = (e: MessageEvent<Res>) => {
      onMessageRef.current(e.data);
    };

    worker.onerror = (e) => {
      console.error('Worker error:', e);
      if (onErrorRef.current) {
        onErrorRef.current(e);
      }
    };

    // 3. Cleanup: Убиваем воркер при размонтировании
    return () => {
      worker.terminate();
      workerRef.current = null;
      setIsReady(false);
    };
  }, [workerFactory]);

  const postMessage = useCallback((message: Req, transfer?: Transferable[]) => {
    if (workerRef.current) {
      // Безопасно передаем пустой массив, если transfer не определен.
      // Это убирает необходимость в non-null assertion (!)
      workerRef.current.postMessage(message, transfer ?? []);
    } else {
      console.warn('Worker is not ready yet');
    }
  }, []);

  return { postMessage, isReady, workerRef };
}
