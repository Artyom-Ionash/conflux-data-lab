/**
 * Набор универсальных Type Guards для Runtime-валидации.
 * Позволяет избегать использования `as` (Type Assertion) и дублирования проверок.
 */

/**
 * Проверяет, что значение определено (не null и не undefined).
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Проверяет, что значение является объектом (и не null).
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Проверяет, является ли значение функцией.
 * Полезно для паттерна State Updater в React.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function isFunction<T extends Function>(value: unknown): value is T {
  return typeof value === 'function';
}

/**
 * Проверяет, входит ли строковое значение в список разрешенных (Enum/Union).
 *
 * @example
 * const MODES = ['dark', 'light'] as const;
 * if (isOneOf(val, MODES)) { ... } // val is 'dark' | 'light'
 */
export function isOneOf<T extends string>(value: unknown, validValues: readonly T[]): value is T {
  return typeof value === 'string' && validValues.includes(value as T);
}

/**
 * Проверяет, является ли значение массивом, где каждый элемент удовлетворяет гарду.
 */
export function isArrayOf<T>(
  value: unknown,
  itemGuard: (item: unknown) => item is T
): value is T[] {
  return Array.isArray(value) && value.every(itemGuard);
}
