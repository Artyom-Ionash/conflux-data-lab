import { useEffect, useRef } from 'react';

import { WorkerPool } from '@/core/browser/worker-pool';

interface UseWorkerPoolOptions {
  workerFactory: () => Worker;
  poolSize?: number;
}

export function useWorkerPool<Req, Res>(options: UseWorkerPoolOptions) {
  const poolRef = useRef<WorkerPool<Req, Res> | null>(null);

  // Инициализация пула (один раз на жизненный цикл компонента)
  useEffect(() => {
    const pool = new WorkerPool<Req, Res>(options.workerFactory, options.poolSize);
    poolRef.current = pool;

    return () => {
      pool.terminate();
      poolRef.current = null;
    };
  }, [options.workerFactory, options.poolSize]);

  const runTask = (data: Req, transfer?: Transferable[]) => {
    if (!poolRef.current) {
      return Promise.reject(new Error('Worker pool is not initialized'));
    }
    return poolRef.current.execute(data, transfer);
  };

  return { runTask };
}
