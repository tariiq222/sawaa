'use client';

import type { AvailableSlot } from '@sawaa/shared';
import { useT, useLocale } from '@/features/locale/locale-provider';

interface SlotPickerProps {
  slots: AvailableSlot[];
  selected: AvailableSlot | null;
  onSelect: (slot: AvailableSlot) => void;
  isLoading?: boolean;
}

export function SlotPicker({ slots, selected, onSelect, isLoading }: SlotPickerProps) {
  const t = useT();
  const locale = useLocale();
  if (isLoading) {
    return <div className="text-center p-8">{t('booking.loadingSlots')}</div>;
  }
  if (slots.length === 0) {
    return <div className="text-center p-8">{t('booking.noSlots')}</div>;
  }
  return (
    <div className="grid gap-3">
      <h2 className="text-xl font-semibold">{t('booking.selectTime')}</h2>
      <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
        {slots.map((slot) => {
          const start = new Date(slot.startTime);
          const timeStr = start.toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });
          const isSelected = selected?.startTime === slot.startTime;
          return (
            <button
              key={slot.startTime}
              onClick={() => onSelect(slot)}
              className={
                isSelected
                  ? 'p-3 cursor-pointer rounded-[var(--radius)] font-semibold border-2 border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)]'
                  : 'p-3 cursor-pointer rounded-[var(--radius)] font-normal border border-[color-mix(in_srgb,var(--primary)_20%,transparent)] bg-transparent'
              }
            >
              {timeStr}
            </button>
          );
        })}
      </div>
    </div>
  );
}
