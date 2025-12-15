import { describe, expect, it } from 'vitest';

import { getLanguageTag, isTextFile, shouldIgnore } from './file-utils';

describe('File Utils', () => {
  describe('shouldIgnore', () => {
    const commonIgnores = ['.git', 'node_modules', '*.png', 'dist'];

    it('ignores exact matches', () => {
      expect(shouldIgnore('.git/config', commonIgnores)).toBe(true);
      expect(shouldIgnore('project/.git/HEAD', commonIgnores)).toBe(true);
    });

    it('ignores directories in path', () => {
      expect(shouldIgnore('node_modules/react/index.js', commonIgnores)).toBe(true);
      expect(shouldIgnore('app/node_modules/foo', commonIgnores)).toBe(true);
    });

    it('ignores extensions (wildcards)', () => {
      expect(shouldIgnore('image.png', commonIgnores)).toBe(true);
      expect(shouldIgnore('assets/icon.png', commonIgnores)).toBe(true);
      // Не должно игнорировать похожие, но другие расширения
      expect(shouldIgnore('image.png.txt', commonIgnores)).toBe(false);
    });

    it('does not ignore allowed files', () => {
      expect(shouldIgnore('app/page.tsx', commonIgnores)).toBe(false);
      expect(shouldIgnore('package.json', commonIgnores)).toBe(false);
    });
  });

  describe('isTextFile', () => {
    const allowed = ['.ts', '.tsx', '.json'];

    it('accepts files from allowed list', () => {
      expect(isTextFile('main.ts', allowed)).toBe(true);
    });

    it('accepts known config files regardless of list', () => {
      expect(isTextFile('.gitignore', [])).toBe(true);
      expect(isTextFile('next.config.ts', [])).toBe(true);
    });

    it('rejects binary/lock files explicitly', () => {
      expect(isTextFile('package-lock.json', allowed)).toBe(false);
      expect(isTextFile('image.jpg', allowed)).toBe(false);
    });
  });

  describe('getLanguageTag', () => {
    it('returns correct mapping', () => {
      expect(getLanguageTag('file.ts')).toBe('typescript');
      expect(getLanguageTag('script.py')).toBe('python');
    });

    it('defaults to text or extension', () => {
      expect(getLanguageTag('unknown.xyz')).toBe('xyz');
      expect(getLanguageTag('LICENSE')).toBe('text');
    });
  });
});
