import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { AvailableSlot } from '@sawaa/shared';
import { SlotPicker } from './slot-picker';
import { LocaleProvider } from '@/features/locale/locale-provider';

// Pin the timezone so period grouping + time formatting are deterministic.
process.env.TZ = 'UTC';

function makeSlot(startIso: string): AvailableSlot {
  return {
    startTime: startIso,
    endTime: startIso, // not used by SlotPicker — only startTime matters for grouping
  };
}

function withLocale(children: ReactNode) {
  return <LocaleProvider locale="en">{children}</LocaleProvider>;
}

describe('SlotPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a loading spinner when isLoading is true', () => {
    render(withLocale(<SlotPicker slots={[]} selected={null} onSelect={vi.fn()} isLoading />));
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders the empty state when slots are empty and not loading', () => {
    render(withLocale(<SlotPicker slots={[]} selected={null} onSelect={vi.fn()} />));
    // The en copy is "No available slots on this date." (booking.noSlots key).
    expect(screen.getByText(/No available slots/i)).toBeTruthy();
  });

  it('groups slots into morning/afternoon/evening periods based on start hour', () => {
    const onSelect = vi.fn();
    const slots = [
      makeSlot('2026-07-01T08:00:00.000Z'), // morning
      makeSlot('2026-07-01T14:00:00.000Z'), // afternoon
      makeSlot('2026-07-01T20:00:00.000Z'), // evening
    ];
    render(withLocale(<SlotPicker slots={slots} selected={null} onSelect={onSelect} />));
    expect(screen.getByText(/morning/i)).toBeTruthy();
    expect(screen.getByText(/afternoon/i)).toBeTruthy();
    expect(screen.getByText(/evening/i)).toBeTruthy();
  });

  it('sorts slots chronologically within each period group', () => {
    const onSelect = vi.fn();
    // Out-of-order input: 10:00, 09:00, 11:00 (all morning).
    const slots = [
      makeSlot('2026-07-01T10:00:00.000Z'),
      makeSlot('2026-07-01T09:00:00.000Z'),
      makeSlot('2026-07-01T11:00:00.000Z'),
    ];
    render(withLocale(<SlotPicker slots={slots} selected={null} onSelect={onSelect} />));
    const radios = screen
      .getAllByRole('radio')
      .map((b) => b.textContent?.trim())
      .filter((t) => t && /^\d/.test(t));
    expect(radios).toEqual(['09:00 AM', '10:00 AM', '11:00 AM']);
  });

  it('calls onSelect with the slot when a time radio is clicked', () => {
    const onSelect = vi.fn();
    const slot = makeSlot('2026-07-01T14:30:00.000Z');
    render(withLocale(<SlotPicker slots={[slot]} selected={null} onSelect={onSelect} />));
    fireEvent.click(screen.getByRole('radio', { name: /02:30 PM/ }));
    expect(onSelect).toHaveBeenCalledWith(slot);
  });

  it('marks the selected slot as aria-checked=true and others as false (no aria-pressed)', () => {
    const slots = [makeSlot('2026-07-01T09:00:00.000Z'), makeSlot('2026-07-01T10:00:00.000Z')];
    const selected = slots[1];
    render(withLocale(<SlotPicker slots={slots} selected={selected} onSelect={vi.fn()} />));
    const radios = screen.getAllByRole('radio');
    expect(radios[1].getAttribute('aria-checked')).toBe('true');
    expect(radios[0].getAttribute('aria-checked')).toBe('false');
    expect(radios[0].getAttribute('aria-pressed')).toBeNull();
  });

  it('renders the time picker as a radiogroup with a localized name', () => {
    const slots = [makeSlot('2026-07-01T09:00:00.000Z')];
    render(withLocale(<SlotPicker slots={slots} selected={null} onSelect={vi.fn()} />));
    expect(screen.getByRole('radiogroup', { name: /Select Time/i })).toBeTruthy();
  });

  it('gives the selected slot roving tabindex 0 and the rest -1', () => {
    const slots = [makeSlot('2026-07-01T09:00:00.000Z'), makeSlot('2026-07-01T10:00:00.000Z')];
    render(withLocale(<SlotPicker slots={slots} selected={slots[1]} onSelect={vi.fn()} />));
    const radios = screen.getAllByRole('radio');
    expect(radios[0].tabIndex).toBe(-1);
    expect(radios[1].tabIndex).toBe(0);
  });

  it('ArrowRight moves to and selects the next slot, wrapping at the end', () => {
    const onSelect = vi.fn();
    const slots = [makeSlot('2026-07-01T09:00:00.000Z'), makeSlot('2026-07-01T10:00:00.000Z')];
    render(withLocale(<SlotPicker slots={slots} selected={null} onSelect={onSelect} />));
    const radios = screen.getAllByRole('radio');
    radios[0].focus();
    fireEvent.keyDown(radios[0], { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenCalledWith(slots[1]);
    expect(radios[1]).toHaveFocus();
    fireEvent.keyDown(radios[1], { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenCalledWith(slots[0]);
    expect(radios[0]).toHaveFocus();
  });

  it('supports Up/Down arrows and Home/End on the slot grid', () => {
    const onSelect = vi.fn();
    const slots = [
      makeSlot('2026-07-01T09:00:00.000Z'),
      makeSlot('2026-07-01T10:00:00.000Z'),
      makeSlot('2026-07-01T11:00:00.000Z'),
    ];
    render(withLocale(<SlotPicker slots={slots} selected={null} onSelect={onSelect} />));
    const radios = screen.getAllByRole('radio');
    radios[2].focus();
    fireEvent.keyDown(radios[2], { key: 'ArrowDown' });
    expect(onSelect).toHaveBeenCalledWith(slots[0]); // wraps
    fireEvent.keyDown(radios[0], { key: 'ArrowUp' });
    expect(onSelect).toHaveBeenCalledWith(slots[2]); // wraps
    fireEvent.keyDown(radios[1], { key: 'Home' });
    expect(onSelect).toHaveBeenCalledWith(slots[0]);
    fireEvent.keyDown(radios[0], { key: 'End' });
    expect(onSelect).toHaveBeenCalledWith(slots[2]);
  });

  it('renders Arabic labels under the ar locale', () => {
    const slots = [makeSlot('2026-07-01T09:00:00.000Z'), makeSlot('2026-07-01T14:00:00.000Z')];
    render(
      <LocaleProvider locale="ar">
        <SlotPicker slots={slots} selected={null} onSelect={vi.fn()} />
      </LocaleProvider>,
    );
    // Period headings are localized to Arabic — dictionary keys:
    //   morning → صباحاً, afternoon → ظهراً, evening → مساءً
    expect(screen.getByText(/صباح/)).toBeTruthy();
    expect(screen.getByText(/ظهر/)).toBeTruthy();
  });
});
