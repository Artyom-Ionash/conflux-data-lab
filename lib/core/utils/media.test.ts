import { afterEach, describe, expect, it, vi } from 'vitest';

import { waitForVideoFrame } from './media';

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
