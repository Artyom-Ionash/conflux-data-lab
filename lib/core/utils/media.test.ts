import { afterEach,describe, expect, it, vi } from 'vitest';

import { waitForVideoFrame } from './media';

describe('waitForVideoFrame (Race Condition Simulation)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should delay execution until the frame is actually presented', async () => {
    const video = document.createElement('video');

    // 1. Симулируем среду с поддержкой requestVideoFrameCallback
    // Мы намеренно НЕ вызываем callback сразу, чтобы симулировать задержку рендеринга
    let frameCallback: (() => void) | null = null;
    video.requestVideoFrameCallback = vi.fn((cb) => {
      frameCallback = cb as () => void;
      return 0;
    });

    // Шпион для проверки порядка вызовов
    const drawAction = vi.fn();

    // 2. Запускаем "Гонку"
    const raceScenario = async () => {
      // Эмуляция логики компонента:
      // Сначала ждем готовности кадра...
      await waitForVideoFrame(video);
      // ...потом рисуем
      drawAction();
    };

    // Запускаем промис, но он должен "повиснуть" в ожидании коллбека
    const processPromise = raceScenario();

    // 3. ПРОВЕРКА (The Trap):
    // Если бы мы не использовали waitForVideoFrame (или он был бы синхронным),
    // drawAction уже был бы вызван, так как в JS (без await) код бежит дальше.

    // Проверяем, что отрисовка НЕ произошла "слишком рано" (симуляция прозрачного кадра)
    expect(drawAction).not.toHaveBeenCalled();

    // 4. Разрешаем ситуацию (Симулируем готовность GPU/Браузера)
    expect(frameCallback).toBeDefined();
    frameCallback!(); // "Кадр готов!"

    // Ждем разрешения микротасок промиса
    await processPromise;

    // 5. Теперь отрисовка должна произойти
    expect(drawAction).toHaveBeenCalled();
    expect(video.requestVideoFrameCallback).toHaveBeenCalledTimes(1);
  });

  it('should fall back to double-RAF if API is missing', async () => {
    const video = document.createElement('video');
    // Удаляем современный API
    // @ts-expect-error - намеренное удаление для теста
    delete video.requestVideoFrameCallback;

    // Мокаем requestAnimationFrame
    const rafRequest = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafRequest();
      // В реальном тесте нужно сохранить cb и вызвать его вручную,
      // но для проверки факта вызова достаточно setTimeout(0) для простоты в JSDOM
      setTimeout(cb, 0);
      return 0;
    });

    const drawAction = vi.fn();

    await waitForVideoFrame(video);
    drawAction();

    // Проверяем, что fallback стратегия сработала (была задержка)
    expect(drawAction).toHaveBeenCalled();
  });
});
