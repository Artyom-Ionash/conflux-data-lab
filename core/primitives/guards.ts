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
 * Проверяет, что значение является строкой.
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Проверяет, что значение является валидным числом (не NaN).
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Проверяет, что значение является объектом (не null и не массив).
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
 * Универсальная проверка на принадлежность классу.
 * Заменяет ручные проверки `instanceof`.
 *
 * Мы используем дженерик Args для вывода типов аргументов конструктора,
 * что позволяет избежать использования `any`.
 *
 * @example
 * if (isInstanceOf(buffer, ArrayBuffer)) { ... }
 * if (isInstanceOf(event.target, HTMLElement)) { ... }
 */
export function isInstanceOf<T, Args extends unknown[]>(
  value: unknown,
  constructor: new (...args: Args) => T
): value is T {
  return value instanceof constructor;
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

/**
 * Проверяет, что массив не пуст.
 * Сужает тип до кортежа, гарантируя наличие хотя бы одного элемента.
 * Полезно при `noUncheckedIndexedAccess`.
 *
 * @example
 * if (isNonEmptyArray(files)) {
 *   const first = files[0]; // TS знает, что это File, а не File | undefined
 * }
 */
export function isNonEmptyArray<T>(value: T[]): value is [T, ...T[]] {
  return value.length > 0;
}
