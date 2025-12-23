import type { CreateGIFResult } from 'gifshot';
import gifshot from 'gifshot';

interface GifOptions {
  images: string[];
  fps: number;
  width: number;
  height: number;
}

/**
 * Обертка над gifshot для превращения callback-style в Promise.
 * Изолирует библиотеку и типизирует входные параметры.
 */
export function createGif(options: GifOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!gifshot || typeof gifshot.createGIF !== 'function') {
      reject(new Error('Gifshot library not loaded correctly'));
      return;
    }

    const { images, fps, width, height } = options;
    const interval = 1 / fps;

    gifshot.createGIF(
      {
        images,
        interval,
        gifWidth: width,
        gifHeight: height,
        numFrames: images.length,
        gifQuality: 10,
        sampleInterval: 10,
      },
      (obj: CreateGIFResult) => {
        if (!obj.error && obj.image) {
          resolve(obj.image);
        } else {
          reject(
            new Error(
              obj.errorCode
                ? `Error ${obj.errorCode}`
                : obj.errorMsg || 'Unknown GIF generation error'
            )
          );
        }
      }
    );
  });
}
