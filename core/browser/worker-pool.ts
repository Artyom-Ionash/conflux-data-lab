/**
 * Менеджер пула воркеров для параллельных вычислений.
 */

interface Task<Req, Res> {
  data: Req;
  // FIX: Добавлен `| undefined`, чтобы соответствовать strict-правилам
  // при передаче переменной, которая может быть undefined.
  transfer?: Transferable[] | undefined;
  resolve: (value: Res) => void;
  reject: (reason: unknown) => void;
}

interface WorkerWrapper {
  id: number;
  worker: Worker;
  busy: boolean;
}

export class WorkerPool<Req, Res> {
  private workers: WorkerWrapper[] = [];
  private queue: Task<Req, Res>[] = [];
  private maxWorkers: number;
  private workerFactory: () => Worker;

  constructor(workerFactory: () => Worker, size?: number) {
    this.workerFactory = workerFactory;
    // Оставляем 1 поток свободным для UI, но не менее 1 воркера
    this.maxWorkers =
      size ??
      Math.max(1, (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 2) - 1);
    this.init();
  }

  private init() {
    for (let i = 0; i < this.maxWorkers; i++) {
      const worker = this.workerFactory();
      this.workers.push({ id: i, worker, busy: false });
    }
  }

  public execute(data: Req, transfer?: Transferable[]): Promise<Res> {
    return new Promise<Res>((resolve, reject) => {
      this.queue.push({ data, transfer, resolve, reject });
      this.dispatch();
    });
  }

  private dispatch() {
    if (this.queue.length === 0) return;

    const availableWorker = this.workers.find((w) => !w.busy);
    if (!availableWorker) return;

    const task = this.queue.shift();
    if (!task) return;

    availableWorker.busy = true;
    const { worker } = availableWorker;

    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
      availableWorker.busy = false;
      this.dispatch();
    };

    worker.onmessage = (e: MessageEvent<Res>) => {
      cleanup();
      task.resolve(e.data);
    };

    worker.onerror = (e) => {
      cleanup();
      task.reject(e);
    };

    worker.postMessage(task.data, task.transfer || []);
  }

  public terminate() {
    this.workers.forEach((w) => w.worker.terminate());
    this.workers = [];
    this.queue = [];
  }
}
