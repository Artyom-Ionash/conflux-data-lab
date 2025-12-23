import { loadImage } from '@/core/browser/canvas';
import { TEXTURE_LIMITS } from '@/lib/graphics/standards';

interface SpriteGeneratorOptions {
  maxHeight: number;
  spacing: number;
  backgroundColor: string;
}

export interface ExtractedFrame {
  time: number;
  dataUrl: string | null;
}

// Вспомогательный тип для кадра с гарантированным URL
type ValidFrame = ExtractedFrame & { dataUrl: string };

const MAX_BROWSER_TEXTURE = TEXTURE_LIMITS.MAX_BROWSER;

export async function generateSpriteSheet(
  frames: ExtractedFrame[],
  options: SpriteGeneratorOptions
): Promise<string> {
  // FIX: Используем Type Predicate (f is ValidFrame), чтобы TS понял, что null ушел
  const validFrames = frames.filter((f): f is ValidFrame => f.dataUrl !== null);

  // FIX: Извлекаем первый элемент и проверяем его явно.
  // Это удовлетворяет 'noUncheckedIndexedAccess', так как TS видит Guard (!firstFrame).
  const firstFrame = validFrames[0];
  if (!firstFrame) {
    throw new Error('No frames to generate sprite');
  }

  // TS теперь знает, что firstFrame определен и dataUrl — string
  const firstImage = await loadImage(firstFrame.dataUrl);

  const scale = options.maxHeight / firstImage.height;
  const scaledWidth = Math.floor(firstImage.width * scale);
  const scaledHeight = options.maxHeight;

  // 2. Calculate dimensions
  const totalWidth = (scaledWidth + options.spacing) * validFrames.length - options.spacing;
  const totalHeight = scaledHeight;

  if (totalWidth > MAX_BROWSER_TEXTURE || totalHeight > MAX_BROWSER_TEXTURE) {
    throw new Error(
      `Texture size (${totalWidth}x${totalHeight}) exceeds browser limit (${MAX_BROWSER_TEXTURE}px).`
    );
  }

  // 3. Setup Canvas
  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create canvas context');

  // 4. Draw Background
  if (options.backgroundColor !== 'transparent') {
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 5. Draw Frames
  for (let i = 0; i < validFrames.length; i++) {
    const frame = validFrames[i];
    // Лишняя проверка не помешает (защита от undefined индекса)
    if (!frame) continue;

    const img = await loadImage(frame.dataUrl);
    const x = i * (scaledWidth + options.spacing);
    ctx.drawImage(img, x, 0, scaledWidth, scaledHeight);
  }

  return canvas.toDataURL('image/png');
}
