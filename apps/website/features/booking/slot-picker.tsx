'use client';

import type { AvailableSlot } from '@deqah/shared';

interface SlotPickerProps {
  slots: AvailableSlot[];
  selected: AvailableSlot | null;
  onSelect: (slot: AvailableSlot) => void;
  isLoading?: boolean;
}

export function SlotPicker({ slots, selected, onSelect, isLoading }: SlotPickerProps) {
  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>Loading slots...</div>;
  }
  if (slots.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>No available slots for this date.</div>;
  }
  return (
    <div className="grid gap-3">
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Select Time</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.75rem' }}>
        {slots.map((slot) => {
          const start = new Date(slot.startTime);
          const timeStr = start.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
          const isSelected = selected?.startTime === slot.startTime;
          return (
            <button
              key={slot.startTime}
              onClick={() => onSelect(slot)}
              style={{
                padding: '0.75rem',
                border: isSelected
                  ? '2px solid var(--primary)'
                  : '1px solid color-mix(in srgb, var(--primary) 20%, transparent)',
                borderRadius: 'var(--radius)',
                background: isSelected
                  ? 'color-mix(in srgb, var(--primary) 15%, transparent)'
                  : 'transparent',
                fontWeight: isSelected ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {timeStr}
            </button>
          );
        })}
      </div>
    </div>
  );
}