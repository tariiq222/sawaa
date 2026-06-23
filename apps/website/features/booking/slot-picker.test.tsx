import { describe, it, expect, vi, beforeEach } from 'vitest';
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
    const buttons = screen
      .getAllByRole('button')
      .map((b) => b.textContent?.trim())
      .filter((t) => t && /^\d/.test(t));
    expect(buttons).toEqual(['09:00 AM', '10:00 AM', '11:00 AM']);
  });

  it('calls onSelect with the slot when a time button is clicked', () => {
    const onSelect = vi.fn();
    const slot = makeSlot('2026-07-01T14:30:00.000Z');
    render(withLocale(<SlotPicker slots={[slot]} selected={null} onSelect={onSelect} />));
    fireEvent.click(screen.getByRole('button', { name: /02:30 PM/ }));
    expect(onSelect).toHaveBeenCalledWith(slot);
  });

  it('marks the selected slot as aria-pressed=true and others as false', () => {
    const slots = [makeSlot('2026-07-01T09:00:00.000Z'), makeSlot('2026-07-01T10:00:00.000Z')];
    const selected = slots[1];
    render(withLocale(<SlotPicker slots={slots} selected={selected} onSelect={vi.fn()} />));
    expect(screen.getByRole('button', { name: /10:00 AM/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: /09:00 AM/ }).getAttribute('aria-pressed')).toBe(
      'false',
    );
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
