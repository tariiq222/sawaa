import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRipple } from './ripple';

function makeMouseEvent(target: HTMLElement, clientX: number, clientY: number) {
  return {
    currentTarget: target,
    clientX,
    clientY,
  } as unknown as React.MouseEvent<HTMLElement>;
}

describe('useRipple', () => {
  let originalCreateElement: typeof document.createElement;
  let originalGetBoundingClientRect: typeof Element.prototype.getBoundingClientRect;
  let originalAppendChild: typeof Node.prototype.appendChild;
  let originalRemove: typeof Element.prototype.remove;
  let appendedNodes: HTMLElement[] = [];

  beforeEach(() => {
    appendedNodes = [];
    originalCreateElement = document.createElement.bind(document);
    originalAppendChild = Node.prototype.appendChild;
    originalRemove = Element.prototype.remove;
    originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

    // Track ripple elements appended to the click target so we can assert
    // they get removed after the setTimeout flushes.
    Node.prototype.appendChild = function <T extends Node>(this: Node, node: T): T {
      if (this instanceof HTMLElement && node instanceof HTMLElement) {
        appendedNodes.push(node);
      }
      return originalAppendChild.call(this, node) as T;
    };
  });

  afterEach(() => {
    document.createElement = originalCreateElement;
    Node.prototype.appendChild = originalAppendChild;
    Element.prototype.remove = originalRemove;
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    vi.useRealTimers();
  });

  it('returns a stable createRipple function reference across renders', () => {
    const { result, rerender } = renderHook(() => useRipple());
    const first = result.current.createRipple;
    rerender();
    expect(result.current.createRipple).toBe(first);
  });

  it('appends a ripple span to the clicked element', () => {
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 100,
      bottom: 100,
      width: 100,
      height: 100,
      toJSON() {
        return {};
      },
    })) as unknown as typeof Element.prototype.getBoundingClientRect;

    const target = originalCreateElement('button') as HTMLButtonElement;
    document.body.appendChild(target);
    appendedNodes.length = 0; // reset — we only care about ripple appends

    const { result } = renderHook(() => useRipple());
    act(() => {
      result.current.createRipple(makeMouseEvent(target, 50, 50));
    });

    const ripples = appendedNodes.filter((n) => n.tagName === 'SPAN');
    expect(ripples.length).toBe(1);
    const ripple = ripples[0] as HTMLSpanElement;
    // The ripple should have inline styles sized to the larger of width/height.
    expect(ripple.style.width).toBe('100px');
    expect(ripple.style.height).toBe('100px');
  });

  it('positions the ripple centered on the click point (clientX/Y - rect.left/top, minus size/2)', () => {
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 10,
      y: 20,
      top: 20,
      left: 10,
      right: 110,
      bottom: 120,
      width: 100,
      height: 100,
      toJSON() {
        return {};
      },
    })) as unknown as typeof Element.prototype.getBoundingClientRect;

    const target = originalCreateElement('button') as HTMLButtonElement;
    document.body.appendChild(target);
    appendedNodes.length = 0;

    const { result } = renderHook(() => useRipple());
    act(() => {
      // Click at (60, 70) → inside the rect (10,20,100,100)
      // x = 60 - 10 = 50; y = 70 - 20 = 50
      // size = 100, so left = 50 - 50 = 0, top = 50 - 50 = 0
      result.current.createRipple(makeMouseEvent(target, 60, 70));
    });

    const ripple = appendedNodes.find((n) => n.tagName === 'SPAN') as HTMLSpanElement;
    expect(ripple.style.left).toBe('0px');
    expect(ripple.style.top).toBe('0px');
  });

  it('uses the larger of width vs height for the ripple size', () => {
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 40,
      bottom: 120,
      width: 40,
      height: 120,
      toJSON() {
        return {};
      },
    })) as unknown as typeof Element.prototype.getBoundingClientRect;

    const target = originalCreateElement('div') as HTMLDivElement;
    document.body.appendChild(target);
    appendedNodes.length = 0;

    const { result } = renderHook(() => useRipple());
    act(() => {
      result.current.createRipple(makeMouseEvent(target, 20, 60));
    });

    const ripple = appendedNodes.find((n) => n.tagName === 'SPAN') as HTMLSpanElement;
    // size = max(40, 120) = 120
    expect(ripple.style.width).toBe('120px');
    expect(ripple.style.height).toBe('120px');
  });

  it('forces the target into relative + overflow:hidden for the ripple to look right', () => {
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 50,
      bottom: 50,
      width: 50,
      height: 50,
      toJSON() {
        return {};
      },
    })) as unknown as typeof Element.prototype.getBoundingClientRect;

    const target = originalCreateElement('button') as HTMLButtonElement;
    expect(target.style.position).toBe('');
    expect(target.style.overflow).toBe('');

    document.body.appendChild(target);

    const { result } = renderHook(() => useRipple());
    act(() => {
      result.current.createRipple(makeMouseEvent(target, 25, 25));
    });

    expect(target.style.position).toBe('relative');
    expect(target.style.overflow).toBe('hidden');
  });

  it('removes the ripple after a tick (setTimeout(0))', () => {
    vi.useFakeTimers();
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 50,
      bottom: 50,
      width: 50,
      height: 50,
      toJSON() {
        return {};
      },
    })) as unknown as typeof Element.prototype.getBoundingClientRect;

    const target = originalCreateElement('button') as HTMLButtonElement;
    document.body.appendChild(target);

    const removeSpy = vi.spyOn(HTMLElement.prototype, 'remove');

    const { result } = renderHook(() => useRipple());
    act(() => {
      result.current.createRipple(makeMouseEvent(target, 10, 10));
    });
    expect(removeSpy).not.toHaveBeenCalled();
    act(() => {
      vi.runAllTimers();
    });
    expect(removeSpy).toHaveBeenCalled();
  });
});
