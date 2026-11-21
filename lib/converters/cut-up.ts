export type CutUpMode = 'lines' | 'words' | 'chunks';

export interface CutUpOptions {
  mode: CutUpMode;
  chunkSize: number;
  seed?: number;
}

export function generateCutUpText(texts: string[], options: CutUpOptions): string {
  const validTexts = texts.map((t) => t.trim()).filter(Boolean);
  if (validTexts.length === 0) return '';

  const { mode, chunkSize = 3 } = options;

  // Step 1: Parse each text into segments based on mode
  const parsedTexts: string[][] = validTexts.map((text) => {
    if (mode === 'lines') {
      return text.split(/\r?\n/).filter(Boolean);
    } else if (mode === 'words') {
      return text.split(/\s+/).filter(Boolean);
    } else if (mode === 'chunks') {
      const words = text.split(/\s+/).filter(Boolean);
      const chunks: string[] = [];
      for (let i = 0; i < words.length; i += chunkSize) {
        const chunkStr = words.slice(i, i + chunkSize).join(' ');
        if (chunkStr) chunks.push(chunkStr);
      }
      return chunks;
    }
    return [];
  });

  // Step 2: Combine / fold-in segments from all texts round-robin
  const combinedSegments: string[] = [];
  const maxLen = Math.max(...parsedTexts.map((pt) => pt.length), 0);

  for (let i = 0; i < maxLen; i++) {
    for (const pt of parsedTexts) {
      const seg = pt[i];
      if (seg) combinedSegments.push(seg);
    }
  }

  // Step 3: Shuffle segments
  for (let i = combinedSegments.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = combinedSegments[i];
    const target = combinedSegments[j];
    if (temp !== undefined && target !== undefined) {
      combinedSegments[i] = target;
      combinedSegments[j] = temp;
    }
  }

  return mode === 'words' ? combinedSegments.join(' ') : combinedSegments.join('\n');
}
