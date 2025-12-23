import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasMovable } from './Canvas';

describe('CanvasMovable (Interaction Physics)', () => {
  // Mock Pointer Capture API (not implemented in JSDOM)
  beforeEach(() => {
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calculates delta correctly with scale = 1 (1:1 movement)', () => {
    const onMove = vi.fn();
    render(
      <CanvasMovable x={0} y={0} scale={1} onMove={onMove}>
        <div data-testid="handle" />
      </CanvasMovable>
    );

    const handle = screen.getByTestId('handle').parentElement;
    if (!handle) throw new Error('Movable wrapper not found');

    // 1. Start Drag at (0, 0)
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, button: 0 });

    // 2. Move to (100, 50)
    fireEvent.pointerMove(handle, { clientX: 100, clientY: 50 });

    // 3. Expect exact match
    expect(onMove).toHaveBeenLastCalledWith({ x: 100, y: 50 });
  });

  it('compensates movement with scale = 2 (0.5x movement)', () => {
    const onMove = vi.fn();
    // Передаем масштаб как число для простоты теста
    render(
      <CanvasMovable x={10} y={10} scale={2} onMove={onMove}>
        <div data-testid="handle" />
      </CanvasMovable>
    );

    const handle = screen.getByTestId('handle').parentElement;
    if (!handle) throw new Error('Movable wrapper not found');

    // 1. Start Drag at (100, 100) -> Initial Position (10, 10)
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100, button: 0 });

    // 2. Move mouse by +100px X and +100px Y (to 200, 200)
    // Formula: NewPos = Initial + (Delta / Scale)
    // Delta = 100, Scale = 2 => Movement = 50
    // Result = 10 + 50 = 60
    fireEvent.pointerMove(handle, { clientX: 200, clientY: 200 });

    expect(onMove).toHaveBeenLastCalledWith({ x: 60, y: 60 });
  });

  it('compensates movement with scale = 0.5 (2x movement)', () => {
    const onMove = vi.fn();
    render(
      <CanvasMovable x={0} y={0} scale={0.5} onMove={onMove}>
        <div data-testid="handle" />
      </CanvasMovable>
    );

    const handle = screen.getByTestId('handle').parentElement;
    if (!handle) throw new Error('Movable wrapper not found');

    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, button: 0 });

    // Move 10px on screen -> should be 20px in world
    fireEvent.pointerMove(handle, { clientX: 10, clientY: 0 });

    expect(onMove).toHaveBeenLastCalledWith({ x: 20, y: 0 });
  });

  it('supports getter function for scale (Dynamic Zoom)', () => {
    const onMove = vi.fn();
    // Simulating a dynamic getter
    const getScale = () => 2;

    render(
      <CanvasMovable x={0} y={0} scale={getScale} onMove={onMove}>
        <div data-testid="handle" />
      </CanvasMovable>
    );

    const handle = screen.getByTestId('handle').parentElement;
    if (!handle) throw new Error('Movable wrapper not found');

    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, button: 0 });
    fireEvent.pointerMove(handle, { clientX: 100, clientY: 0 });

    // 100px / 2 = 50px
    expect(onMove).toHaveBeenLastCalledWith({ x: 50, y: 0 });
  });

  it('ignores right clicks', () => {
    const onMove = vi.fn();
    const onDragStart = vi.fn();
    render(
      <CanvasMovable x={0} y={0} scale={1} onMove={onMove} onDragStart={onDragStart}>
        <div data-testid="handle" />
      </CanvasMovable>
    );

    const handle = screen.getByTestId('handle').parentElement;
    if (!handle) throw new Error('Movable wrapper not found');

    // Right click (button 2)
    fireEvent.pointerDown(handle, { button: 2 });

    expect(onDragStart).not.toHaveBeenCalled();
  });
});
