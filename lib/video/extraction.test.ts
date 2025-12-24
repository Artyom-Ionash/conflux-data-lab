import { describe, expect, it } from 'vitest';

import { applySymmetricLoop, calculateTimestamps } from './extraction';

describe('Video Extraction Logic', () => {
  describe('calculateTimestamps', () => {
    it('should generate a linear sequence', () => {
      const params = { startTime: 0, endTime: 10, frameStep: 2 };
      const duration = 20;

      const result = calculateTimestamps(params, duration);
      // 0, 2, 4, 6, 8, 10 -> 6 кадров
      expect(result).toEqual([0, 2, 4, 6, 8, 10]);
    });

    it('should clamp to video duration', () => {
      const params = { startTime: 0, endTime: 10, frameStep: 2 };
      const duration = 5; // Видео короче, чем запрос

      const result = calculateTimestamps(params, duration);
      // 0, 2, 4 -> остановка, т.к. следующий (6) > 5
      expect(result).toEqual([0, 2, 4]);
    });
  });

  describe('applySymmetricLoop', () => {
    it('should implement Ping-Pong loop for 3 frames', () => {
      // Input: A, B, C
      const frames = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];

      const result = applySymmetricLoop(frames, true);

      // Expected: A, B, C, B
      // (Мы не дублируем A и C, чтобы склейка циклов была плавной: A,B,C,B -> A,B,C,B...)
      expect(result).toHaveLength(4);
      expect(result[0]?.id).toBe('A');
      expect(result[1]?.id).toBe('B');
      expect(result[2]?.id).toBe('C');
      expect(result[3]?.id).toBe('B');
    });

    it('should ensure Referential Integrity (No Cloning)', () => {
      // Это критический тест: мы проверяем, что объект не был скопирован.
      // Это важно для производительности (кадры могут содержать тяжелые Base64 строки)

      const frameA = { id: 'A', heavyData: '...' };
      const frameB = { id: 'B', heavyData: '...' }; // Target
      const frameC = { id: 'C', heavyData: '...' };

      const frames = [frameA, frameB, frameC];
      const result = applySymmetricLoop(frames, true);

      const originalFrameB = result[1];
      const loopedFrameB = result[3];

      // Ссылка должна быть идентичной (строгое равенство ===)
      expect(loopedFrameB).toBe(originalFrameB);

      // И это должен быть именно тот объект, который мы создали
      expect(loopedFrameB).toBe(frameB);
    });

    it('should handle 4 frames', () => {
      // Input: A, B, C, D
      // Loop:  A, B, C, D, C, B
      const input = ['A', 'B', 'C', 'D'];
      const result = applySymmetricLoop(input, true);

      expect(result).toEqual(['A', 'B', 'C', 'D', 'C', 'B']);
    });

    it('should do nothing if disabled', () => {
      const input = ['A', 'B', 'C'];
      const result = applySymmetricLoop(input, false);
      expect(result).toEqual(input);
      // Массив должен быть тем же самым (или копией, но содержимое равно)
      expect(result).toHaveLength(3);
    });

    it('should do nothing for small arrays (< 3)', () => {
      // Для 2 кадров [A, B] "середина" пуста, поэтому возвращаем [A, B]
      // Пинг-понг из двух кадров это просто цикл, симметрия тут не нужна.
      const input = ['A', 'B'];
      const result = applySymmetricLoop(input, true);
      expect(result).toEqual(['A', 'B']);
    });
  });
});
