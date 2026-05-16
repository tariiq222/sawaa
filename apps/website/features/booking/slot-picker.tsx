'use client';

import type { AvailableSlot } from '@sawaa/shared';
import { useT } from '@/features/locale/locale-provider';

interface SlotPickerProps {
  slots: AvailableSlot[];
  selected: AvailableSlot | null;
  onSelect: (slot: AvailableSlot) => void;
  isLoading?: boolean;
}

export function SlotPicker({ slots, selected, onSelect, isLoading }: SlotPickerProps) {
  const t = useT();
  if (isLoading) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>{t('booking.loadingSlots')}</div>;
  }
  if (slots.length === 0) {
    return <div style={{ textAlign: 'center', padding: '2rem' }}>{t('booking.noSlots')}</div>;
  }
  return (
    <div className="grid gap-3">
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{t('booking.selectTime')}</h2>
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