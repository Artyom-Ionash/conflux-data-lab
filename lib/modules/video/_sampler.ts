/**
 * [КРИСТАЛЛ] VideoFrameSampler
 * Низкоуровневый инструмент для дискретного извлечения кадров.
 */

import { waitForVideoFrame } from '@/lib/core/utils/media';

export class VideoFrameSampler {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(private video: HTMLVideoElement) {
    this.canvas = document.createElement('canvas');
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Failed to create 2d context for sampler');
    this.ctx = context;

    // Синхронизируем размеры при инициализации
    this.canvas.width = video.videoWidth;
    this.canvas.height = video.videoHeight;
  }

  /**
   * Захватывает кадр на указанной временной метке.
   */
  public async captureAt(time: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const onSeeked = async () => {
        try {
          // Ожидаем фактической готовности кадра в GPU
          await waitForVideoFrame(this.video);

          // Рисуем на внутренний холст
          this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);

          // Возвращаем данные
          resolve(this.canvas.toDataURL('image/png'));
        } catch (e) {
          reject(e);
        }
      };

      // Подписываемся разово на событие перемещения головки
      this.video.addEventListener('seeked', onSeeked, { once: true });
      this.video.currentTime = time;
    });
  }

  public get dimensions() {
    return { width: this.canvas.width, height: this.canvas.height };
  }
}
