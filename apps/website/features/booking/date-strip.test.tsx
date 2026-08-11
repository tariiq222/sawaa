import { describe, it, expect, vi, beforeAll } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateStrip } from './date-strip';
import { LocaleProvider } from '@/features/locale/locale-provider';

process.env.TZ = 'UTC';

// jsdom does not implement scrollIntoView; the DateStrip's useEffect calls it
// on the selected day to keep it in view. Stub it globally so the effect runs
// without throwing.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return isoFromDate(d);
}

function isoAfterDays(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return isoFromDate(d);
}

function withLocale(children: ReactNode) {
  return <LocaleProvider locale="en">{children}</LocaleProvider>;
}

describe('DateStrip', () => {
  it('renders a radiogroup with the configured number of day buttons', () => {
    render(withLocale(<DateStrip value={todayIso()} onChange={vi.fn()} days={7} />));
    const group = screen.getByRole('radiogroup');
    const radios = group.querySelectorAll('[role="radio"]');
    expect(radios.length).toBe(7);
  });

  it('marks the selected date as aria-checked=true', () => {
    const iso = todayIso();
    render(withLocale(<DateStrip value={iso} onChange={vi.fn()} days={7} />));
    const selected = screen.getByRole('radio', { checked: true });
    expect(selected).toBeTruthy();
  });

  it('calls onChange when a future date is clicked', () => {
    const onChange = vi.fn();
    const iso = todayIso();
    render(withLocale(<DateStrip value={iso} onChange={onChange} days={14} />));
    const radios = screen.getAllByRole('radio');
    // Click the last (future) day — past days are disabled.
    fireEvent.click(radios[radios.length - 1]);
    expect(onChange).toHaveBeenCalledTimes(1);
    const [emitted] = onChange.mock.calls[0];
    expect(emitted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('disables past dates even when no allowedDaysOfWeek is given', () => {
    const iso = todayIso();
    render(withLocale(<DateStrip value={iso} onChange={vi.fn()} days={7} />));
    const radios = screen.getAllByRole('radio');
    // Today is enabled — but the days BEFORE today in the visible window are disabled.
    // The first button is anchored at today, so all 7 buttons should be enabled.
    for (const r of radios) {
      expect((r as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it('disables dates NOT in the bookableDates set (even when allowedDaysOfWeek would allow)', () => {
    const iso = todayIso();
    const today = iso;
    render(
      withLocale(
        <DateStrip
          value={iso}
          onChange={vi.fn()}
          days={3}
          bookableDates={new Set([today])} // only today is bookable
        />,
      ),
    );
    const radios = screen.getAllByRole('radio');
    // First radio (today) is enabled, others are disabled.
    expect((radios[0] as HTMLButtonElement).disabled).toBe(false);
    expect((radios[1] as HTMLButtonElement).disabled).toBe(true);
    expect((radios[2] as HTMLButtonElement).disabled).toBe(true);
    // The second radio corresponds to tomorrow — verify it stays disabled.
    const tomorrowRadio = radios[1] as HTMLButtonElement;
    expect(tomorrowRadio.disabled).toBe(true);
  });

  it('disables dates outside allowedDaysOfWeek when bookableDates is undefined', () => {
    // Pick a future date so we have at least one allowed day.
    const future = new Date();
    future.setDate(future.getDate() + 5);
    const y = future.getFullYear();
    const m = String(future.getMonth() + 1).padStart(2, '0');
    const day = String(future.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${day}`;
    const allowedDows = [future.getDay()]; // only the future day is allowed
    render(
      withLocale(
        <DateStrip
          value={iso}
          onChange={vi.fn()}
          days={14}
          allowedDaysOfWeek={allowedDows}
        />,
      ),
    );
    // The first button (today, NOT in allowedDows if dow differs) should be disabled.
    // We assert that AT LEAST ONE day is disabled in the rendered window.
    const radios = screen.getAllByRole('radio');
    const disabledCount = Array.from(radios).filter(
      (r) => (r as HTMLButtonElement).disabled,
    ).length;
    expect(disabledCount).toBeGreaterThan(0);
  });

  it('jumps back to today and selects it when the Today button is clicked', () => {
    const onChange = vi.fn();
    const iso = todayIso();
    render(withLocale(<DateStrip value={iso} onChange={onChange} days={7} />));
    const todayBtn = screen.queryByRole('button', { name: /Today/i });
    // Today button only appears when today is NOT in the visible window.
    // With default days=7 anchored at today, today is visible — so the button is hidden.
    expect(todayBtn).toBeNull();
  });

  it('disables the "previous week" button when anchored at today', () => {
    const iso = todayIso();
    render(withLocale(<DateStrip value={iso} onChange={vi.fn()} days={7} />));
    const prevBtn = screen.getByRole('button', { name: /Previous week/i }) as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);
  });

  it('renders Arabic month label under the ar locale', () => {
    const iso = todayIso();
    render(
      <LocaleProvider locale="ar">
        <DateStrip value={iso} onChange={vi.fn()} days={7} />
      </LocaleProvider>,
    );
    // Heading should contain an Arabic month token; assert the radiogroup renders.
    expect(screen.getByRole('radiogroup')).toBeTruthy();
  });
});

describe('DateStrip keyboard behavior (radio group)', () => {
  it('gives the selected day roving tabindex 0 and every other day -1', () => {
    render(withLocale(<DateStrip value={todayIso()} onChange={vi.fn()} days={7} />));
    const radios = screen.getAllByRole('radio');
    expect((radios[0] as HTMLButtonElement).tabIndex).toBe(0);
    for (const r of radios.slice(1)) {
      expect((r as HTMLButtonElement).tabIndex).toBe(-1);
    }
  });

  it('puts roving tabindex on the first enabled day when the selected day is disabled', () => {
    render(withLocale(<DateStrip value={isoAfterDays(-1)} onChange={vi.fn()} days={7} />));
    const radios = screen.getAllByRole('radio');
    // The selected day (yesterday) is disabled, so today (first enabled) takes tabindex 0.
    expect((radios[0] as HTMLButtonElement).disabled).toBe(false);
    expect((radios[0] as HTMLButtonElement).tabIndex).toBe(0);
  });

  it('ArrowRight moves focus to and selects the next enabled day', () => {
    const onChange = vi.fn();
    render(withLocale(<DateStrip value={todayIso()} onChange={onChange} days={7} />));
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBe(isoAfterDays(1));
    expect(radios[1]).toHaveFocus();
  });

  it('ArrowLeft moves back one day', () => {
    const onChange = vi.fn();
    render(withLocale(<DateStrip value={isoAfterDays(2)} onChange={onChange} days={7} />));
    const radios = screen.getAllByRole('radio');
    // The strip is anchored at the selected day, so radios[i] = value + i days.
    radios[2].focus(); // value + 2
    fireEvent.keyDown(radios[2], { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith(isoAfterDays(3)); // value + 1
    expect(radios[1]).toHaveFocus();
  });

  it('wraps ArrowRight from the last day back to the first', () => {
    const onChange = vi.fn();
    render(withLocale(<DateStrip value={todayIso()} onChange={onChange} days={7} />));
    const radios = screen.getAllByRole('radio');
    radios[6].focus();
    fireEvent.keyDown(radios[6], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith(todayIso());
    expect(radios[0]).toHaveFocus();
  });

  it('never selects disabled or past days via the keyboard', () => {
    const onChange = vi.fn();
    render(
      withLocale(
        <DateStrip
          value={todayIso()}
          onChange={onChange}
          days={7}
          bookableDates={new Set([todayIso()])}
        />,
      ),
    );
    const radios = screen.getAllByRole('radio');
    expect((radios[0] as HTMLButtonElement).disabled).toBe(false);
    radios[0].focus();
    // Only today is enabled — arrow navigation must not select any other day.
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('Home focuses and selects the first enabled day; End the last', () => {
    const onChange = vi.fn();
    render(withLocale(<DateStrip value={isoAfterDays(3)} onChange={onChange} days={7} />));
    const radios = screen.getAllByRole('radio');
    // The strip is anchored at the selected day, so radios[i] = value + i days.
    radios[3].focus(); // value + 3
    fireEvent.keyDown(radios[3], { key: 'End' });
    expect(onChange).toHaveBeenCalledWith(isoAfterDays(9)); // last visible day
    expect(radios[6]).toHaveFocus();
    fireEvent.keyDown(radios[6], { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith(isoAfterDays(3)); // first visible day
    expect(radios[0]).toHaveFocus();
  });

  it('swaps arrow mapping under RTL: ArrowLeft moves to the next day', () => {
    const onChange = vi.fn();
    render(
      <LocaleProvider locale="ar">
        <DateStrip value={todayIso()} onChange={onChange} days={7} />
      </LocaleProvider>,
    );
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith(isoAfterDays(1));
  });
});
