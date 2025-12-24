import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Базовые пропсы для любого UI компонента.
 */
export interface BaseProps {
  children?: ReactNode;
  className?: string;
}

/**
 * Пропсы для компонентов, поддерживающих паттерн "asChild" (через Radix UI Slot).
 */
export interface AsChildProps {
  asChild?: boolean;
}

/**
 * Тип для компонентов-оберток над нативными HTML элементами.
 */
export type ElementProps<T extends HTMLElement> = HTMLAttributes<T> & BaseProps;

/**
 * Расширенная версия ElementProps с поддержкой паттерна asChild.
 */
export type PolymorphicProps<T extends HTMLElement> = ElementProps<T> & AsChildProps;
