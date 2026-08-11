import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  rovingTabIndex,
  handleRadioGroupKeyDown,
  type RadioGroupKeyEvent,
  type RadioGroupKeyNavOptions,
} from './radio-group-nav';

/**
 * Shared keyboard/roving-tabindex behavior for the booking one-of-many
 * pickers (WAI-ARIA radio group pattern). The helpers are pure so they are
 * unit-tested against a bare DOM group here; the component tests then verify
 * the wiring.
 */

function makeGroup(n: number, disabled: number[] = []): HTMLElement {
  const group = document.createElement('div');
  for (let i = 0; i < n; i++) {
    const btn = document.createElement('button');
    btn.setAttribute('role', 'radio');
    btn.setAttribute('tabindex', '-1');
    if (disabled.includes(i)) btn.setAttribute('disabled', '');
    group.appendChild(btn);
  }
  document.body.appendChild(group);
  return group;
}

function fireKey(
  group: HTMLElement,
  key: string,
  target: HTMLElement,
  onSelect: (index: number) => void,
  options?: RadioGroupKeyNavOptions,
) {
  const preventDefault = vi.fn();
  const event = { key, target, preventDefault } as unknown as RadioGroupKeyEvent;
  handleRadioGroupKeyDown(event, group, onSelect, options);
  return preventDefault;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('rovingTabIndex', () => {
  it('returns the first enabled option when nothing is selected', () => {
    expect(
      rovingTabIndex([
        { disabled: false, selected: false },
        { disabled: false, selected: false },
      ]),
    ).toBe(0);
  });

  it('returns the index of the selected option when it is enabled', () => {
    expect(
      rovingTabIndex([
        { disabled: false, selected: false },
        { disabled: false, selected: true },
      ]),
    ).toBe(1);
  });

  it('skips disabled options when picking the first enabled', () => {
    expect(
      rovingTabIndex([
        { disabled: true, selected: false },
        { disabled: false, selected: false },
        { disabled: true, selected: false },
      ]),
    ).toBe(1);
  });

  it('falls back to the first enabled option when the selected one is disabled', () => {
    expect(
      rovingTabIndex([
        { disabled: true, selected: true },
        { disabled: false, selected: false },
      ]),
    ).toBe(1);
  });

  it('returns -1 when every option is disabled', () => {
    expect(rovingTabIndex([{ disabled: true, selected: true }])).toBe(-1);
  });
});

describe('handleRadioGroupKeyDown', () => {
  it('ArrowRight moves to and selects the next enabled radio, preventing default', () => {
    const group = makeGroup(3);
    const onSelect = vi.fn();
    const preventDefault = fireKey(group, 'ArrowRight', group.children[0] as HTMLElement, onSelect);
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(document.activeElement).toBe(group.children[1]);
    expect(preventDefault).toHaveBeenCalled();
  });

  it('ArrowRight wraps from the last radio back to the first', () => {
    const group = makeGroup(3);
    const onSelect = vi.fn();
    fireKey(group, 'ArrowRight', group.children[2] as HTMLElement, onSelect);
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(document.activeElement).toBe(group.children[0]);
  });

  it('ArrowLeft moves to the previous radio and wraps', () => {
    const group = makeGroup(3);
    const onSelect = vi.fn();
    fireKey(group, 'ArrowLeft', group.children[0] as HTMLElement, onSelect);
    expect(onSelect).toHaveBeenCalledWith(2);
    fireKey(group, 'ArrowLeft', group.children[1] as HTMLElement, onSelect);
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('ArrowDown/ArrowUp work on grids (axis both)', () => {
    const group = makeGroup(3);
    const onSelect = vi.fn();
    fireKey(group, 'ArrowDown', group.children[0] as HTMLElement, onSelect);
    expect(onSelect).toHaveBeenCalledWith(1);
    fireKey(group, 'ArrowUp', group.children[0] as HTMLElement, onSelect);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('skips disabled options while moving and wrapping', () => {
    const group = makeGroup(4, [1, 2]); // only 0 and 3 enabled
    const onSelect = vi.fn();
    fireKey(group, 'ArrowRight', group.children[0] as HTMLElement, onSelect);
    expect(onSelect).toHaveBeenCalledWith(3);
    fireKey(group, 'ArrowRight', group.children[3] as HTMLElement, onSelect);
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('Home goes to the first enabled radio and End to the last enabled', () => {
    const group = makeGroup(4, [0, 3]); // enabled: 1, 2
    const onSelect = vi.fn();
    fireKey(group, 'Home', group.children[2] as HTMLElement, onSelect);
    expect(onSelect).toHaveBeenCalledWith(1);
    fireKey(group, 'End', group.children[1] as HTMLElement, onSelect);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('swaps Left/Right under RTL so ArrowLeft moves forward', () => {
    const group = makeGroup(3);
    const onSelect = vi.fn();
    fireKey(group, 'ArrowLeft', group.children[0] as HTMLElement, onSelect, { rtl: true });
    expect(onSelect).toHaveBeenCalledWith(1);
    fireKey(group, 'ArrowRight', group.children[1] as HTMLElement, onSelect, { rtl: true });
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it('ignores vertical arrows on a horizontal strip (axis horizontal)', () => {
    const group = makeGroup(3);
    const onSelect = vi.fn();
    const preventDefault = fireKey(group, 'ArrowUp', group.children[0] as HTMLElement, onSelect, {
      axis: 'horizontal',
    });
    expect(onSelect).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('ignores horizontal arrows on a vertical list (axis vertical)', () => {
    const group = makeGroup(3);
    const onSelect = vi.fn();
    const preventDefault = fireKey(group, 'ArrowRight', group.children[0] as HTMLElement, onSelect, {
      axis: 'vertical',
    });
    expect(onSelect).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('does nothing when only one option is enabled (no movement)', () => {
    const group = makeGroup(3, [1, 2]);
    const onSelect = vi.fn();
    const preventDefault = fireKey(group, 'ArrowRight', group.children[0] as HTMLElement, onSelect);
    expect(onSelect).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('ignores keys when the event target is not one of the radios', () => {
    const group = makeGroup(3);
    const onSelect = vi.fn();
    const preventDefault = fireKey(group, 'ArrowRight', group, onSelect);
    expect(onSelect).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('ignores unknown keys', () => {
    const group = makeGroup(3);
    const onSelect = vi.fn();
    const preventDefault = fireKey(group, 'Enter', group.children[0] as HTMLElement, onSelect);
    expect(onSelect).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
