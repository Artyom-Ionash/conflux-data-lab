/**
 * Возвращает числовой коэффициент соотношения сторон.
 */
export function getAspectRatio(width?: number | null, height?: number | null): number {
  if (!width || !height) return 1;
  return width / height;
}
