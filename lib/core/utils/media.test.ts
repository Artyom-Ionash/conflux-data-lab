import { afterEach, describe, expect, it, vi } from 'vitest';

import { getTopLeftPixelColor,waitForVideoFrame } from './media';

// --- TYPE DEFINITIONS FOR JSDOM ENVIRONMENT ---
interface VideoFrameMetadata {
  presentationTime: number;
  expectedDisplayTime: number;
  width: number;
  height: number;
  mediaTime: number;
  presentedFrames: number;
  processingDuration?: number;
  captureTime?: number;
  receiveTime?: number;
  rtpTimestamp?: number;
}

type VideoFrameRequestCallback = (now: number, metadata: VideoFrameMetadata) => void;

describe('waitForVideoFrame (Race Condition Simulation)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should delay execution until the frame is actually presented', async () => {
    const video = document.createElement('video');

    const rvfcMock = vi.fn<(callback: VideoFrameRequestCallback) => number>(() => 0);
    video.requestVideoFrameCallback = rvfcMock;

    const drawAction = vi.fn();

    const raceScenario = async () => {
      await waitForVideoFrame(video);
      drawAction();
    };

    const processPromise = raceScenario();

    expect(drawAction).not.toHaveBeenCalled();

    const registeredCallback = rvfcMock.mock.lastCall?.[0];

    if (!registeredCallback) {
      throw new Error('requestVideoFrameCallback was never called');
    }

    const mockMetadata: VideoFrameMetadata = {
      presentationTime: 0,
      expectedDisplayTime: 0,
      width: 1920,
      height: 1080,
      mediaTime: 0,
      presentedFrames: 1,
    };

    registeredCallback(performance.now(), mockMetadata);

    await processPromise;

    expect(drawAction).toHaveBeenCalled();
  });

  it('should fall back to double-RAF if API is missing', async () => {
    const video = document.createElement('video');

    // FIX: Используем Reflect.deleteProperty вместо (video as any).
    // Это легальный способ удалить свойство в рантайме без отключения типов.
    Reflect.deleteProperty(video, 'requestVideoFrameCallback');

    const rafRequest = vi.fn();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafRequest();
      setTimeout(cb, 0);
      return 0;
    });

    const drawAction = vi.fn();

    await waitForVideoFrame(video);
    drawAction();

    expect(drawAction).toHaveBeenCalled();
  });
});

describe('getTopLeftPixelColor (Unit Test with Mocks)', () => {
  it('should use cropping (9 arguments) instead of scaling to avoid color averaging', () => {
    // 1. Создаем моки данных
    const mockImageData = { data: new Uint8ClampedArray([10, 20, 30, 255]) };
    const drawImageSpy = vi.fn();
    const getImageDataSpy = vi.fn().mockReturnValue(mockImageData);

    const mockContext = {
      drawImage: drawImageSpy,
      getImageData: getImageDataSpy,
    };

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(mockContext),
    };

    // 2. Мокируем createElement без использования 'any'
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'canvas') {
        // Используем unknown как безопасный мост для приведения типов в моках
        return mockCanvas as unknown as HTMLCanvasElement;
      }
      return {} as HTMLElement;
    });

    // 3. Выполняем тест
    const source = {} as CanvasImageSource;
    const result = getTopLeftPixelColor(source);

    // 4. Проверяем аргументы вызова (именно 9 аргументов гарантируют кроппинг)
    expect(drawImageSpy).toHaveBeenCalledWith(
      source,
      0,
      0,
      1,
      1, // Откуда (source x, y, w, h)
      0,
      0,
      1,
      1 // Куда (dest x, y, w, h)
    );

    expect(getImageDataSpy).toHaveBeenCalledWith(0, 0, 1, 1);
    expect(result).toEqual({ r: 10, g: 20, b: 30 });

    vi.restoreAllMocks();
  });
});
