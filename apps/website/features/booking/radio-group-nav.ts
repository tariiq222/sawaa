/**
 * Shared keyboard + roving-tabindex behavior for the booking one-of-many
 * pickers (date strip, slots, therapists, services, branches), implementing
 * the WAI-ARIA "Radio Group" pattern:
 * https://www.w3.org/WAI/ARIA/apg/patterns/radio-group/
 *
 * Keyboard mapping:
 * - Arrow keys move to the previous/next ENABLED option, wrap at the ends,
 *   focus it and select it (the moved-to radio becomes checked).
 * - Home/End move to the first/last ENABLED option.
 * - `axis: 'horizontal'` (date strip) handles only Left/Right;
 *   `axis: 'vertical'` handles only Up/Down; grids/lists (`'both'`) handle
 *   all four arrows using linear reading order (row-major, wrapping) — the
 *   column count is layout-dependent and not observable in jsdom, so grid
 *   components use the same predictable mapping as lists.
 * - RTL: components under `dir=rtl` flow right-to-left, so `rtl: true`
 *   swaps Left/Right so the arrows follow the visual direction (e.g. in
 *   Arabic the date strip grows leftward: ArrowLeft = next day).
 * - Disabled options are skipped. When nothing can move (single enabled
 *   option), the key is ignored and no selection fires.
 */

export interface RadioGroupOption {
  disabled: boolean;
  selected: boolean;
}

export type RadioGroupAxis = 'horizontal' | 'vertical' | 'both';

export interface RadioGroupKeyEvent {
  key: string;
  target: EventTarget | null;
  preventDefault: () => void;
}

export interface RadioGroupKeyNavOptions {
  axis?: RadioGroupAxis;
  rtl?: boolean;
}

/**
 * Index of the option that should hold roving tabindex 0: the selected
 * option when enabled, otherwise the first enabled option, or -1 when every
 * option is disabled.
 */
export function rovingTabIndex(options: RadioGroupOption[]): number {
  const firstEnabled = options.findIndex((o) => !o.disabled);
  if (firstEnabled === -1) return -1;
  const selected = options.findIndex((o) => o.selected && !o.disabled);
  return selected >= 0 ? selected : firstEnabled;
}

/**
 * Handle an arrow/Home/End keydown for a radio group. Attach this to the
 * `role="radiogroup"` container's onKeyDown; it only acts when the event
 * target is one of the group's `role="radio"` options (i.e. focus is inside
 * the group), moves focus to the target option and invokes `onSelect(index)`
 * so the caller can commit the selection.
 */
export function handleRadioGroupKeyDown(
  event: RadioGroupKeyEvent,
  groupEl: HTMLElement,
  onSelect: (index: number) => void,
  { axis = 'both', rtl = false }: RadioGroupKeyNavOptions = {},
): void {
  const radios = Array.from(groupEl.querySelectorAll<HTMLElement>('[role="radio"]'));
  const current = radios.findIndex((el) => el === event.target);
  if (current === -1) return; // focus is not on one of this group's radios

  const enabled = radios.map(
    (el) => !el.hasAttribute('disabled') && el.getAttribute('aria-disabled') !== 'true',
  );
  if (!enabled[current]) return; // a disabled radio cannot be focused normally
  const enabledIndices = radios.map((_, i) => i).filter((i) => enabled[i]);
  if (enabledIndices.length === 0) return;

  let dir: 'next' | 'prev' | 'first' | 'last' | null = null;
  switch (event.key) {
    case 'ArrowLeft':
      if (axis === 'vertical') return;
      dir = rtl ? 'next' : 'prev';
      break;
    case 'ArrowRight':
      if (axis === 'vertical') return;
      dir = rtl ? 'prev' : 'next';
      break;
    case 'ArrowUp':
      if (axis === 'horizontal') return;
      dir = 'prev';
      break;
    case 'ArrowDown':
      if (axis === 'horizontal') return;
      dir = 'next';
      break;
    case 'Home':
      dir = 'first';
      break;
    case 'End':
      dir = 'last';
      break;
    default:
      return;
  }

  let target = -1;
  if (dir === 'first') {
    target = enabledIndices[0];
  } else if (dir === 'last') {
    target = enabledIndices[enabledIndices.length - 1];
  } else {
    const pos = enabledIndices.indexOf(current);
    const n = enabledIndices.length;
    target = dir === 'next' ? enabledIndices[(pos + 1) % n] : enabledIndices[(pos - 1 + n) % n];
  }

  if (target === current) return; // nothing to move to (e.g. single option)
  event.preventDefault();
  radios[target].focus();
  onSelect(target);
}
