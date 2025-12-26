import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { Workbench } from './Workbench';

describe('Workbench (Industrial Layout)', () => {
  // 1. Проверка режима "Overlay Mode"
  // Мы должны убедиться, что верстак вырывается из потока документа
  it('Root enforces Overlay Mode (fixed positioning & base z-index)', () => {
    const { container } = render(
      <Workbench.Root>
        <div>Content</div>
      </Workbench.Root>
    );

    const rootElement = container.firstChild as HTMLElement;

    // Проверяем наличие критических классов для перекрытия
    expect(rootElement).toHaveClass('fixed');
    expect(rootElement).toHaveClass('inset-0');
    expect(rootElement).toHaveClass('z-base');
  });

  // 2. Проверка изоляции скролла
  it('Root enforces Scroll Isolation (overscroll-none)', () => {
    const { container } = render(
      <Workbench.Root>
        <div>Content</div>
      </Workbench.Root>
    );

    const rootElement = container.firstChild as HTMLElement;

    // Гарантируем, что скролл заблокирован локально
    expect(rootElement).toHaveClass('overscroll-none');
    expect(rootElement).toHaveClass('overflow-hidden');
  });

  // 3. Проверка Stage
  // Stage тоже должен предотвращать эластичный скролл (для канваса)
  it('Stage prevents overscroll propagation', () => {
    render(
      <Workbench.Root>
        <Workbench.Stage data-testid="stage">
          <div>Canvas Area</div>
        </Workbench.Stage>
      </Workbench.Root>
    );

    const stageElement = screen.getByTestId('stage');
    expect(stageElement).toHaveClass('overscroll-none');
  });

  // 4. Проверка наложения стилей (Merge)
  // Убедимся, что наши жесткие правила не ломают кастомизацию, если она нужна
  it('merges custom classNames correctly', () => {
    const { container } = render(
      <Workbench.Root className="custom-test-class">
        <div>Content</div>
      </Workbench.Root>
    );

    const rootElement = container.firstChild as HTMLElement;
    expect(rootElement).toHaveClass('fixed'); // Стандартный класс остался
    expect(rootElement).toHaveClass('custom-test-class'); // Кастомный добавился
  });
});
