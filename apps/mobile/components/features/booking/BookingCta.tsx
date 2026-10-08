import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';

import { sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { FloatingCta } from '@/components/ui/FloatingCta';
import type { DirState } from '@/hooks/useDir';
import { formatTime, type Slot } from './TimeSlotsGrid';
import { formatCurrencyAmount } from '@/lib/currency-display';

interface BookingCtaProps {
  selectedDay: Date;
  selectedSlot: Slot | null;
  chargedPrice?: string;
  currency?: string;
  onConfirm: () => void;
  dir: DirState;
  f400: string;
  f700: string;
}

/** Step-1 action: the selected day, time and price on one caption line above «متابعة». */
export function BookingCta({
  selectedDay,
  selectedSlot,
  chargedPrice,
  currency,
  onConfirm,
  dir,
  f400,
  f700,
}: BookingCtaProps) {
  const colors = useSawaaColors();
  const { t } = useTranslation();
  const dayLabel = new Intl.DateTimeFormat(dir.isRTL ? 'ar-SA' : 'en-US', { calendar: 'gregory', weekday: 'short' }).format(selectedDay);
  const dayNum = dir.isRTL ? selectedDay.getDate().toLocaleString('ar-SA') : selectedDay.getDate();
  const price = chargedPrice != null && chargedPrice.trim() !== '' ? Number(chargedPrice) : NaN;
  const parts: string[] = [];
  if (selectedSlot) parts.push(`${dayLabel} ${dayNum} · ${formatTime(selectedSlot.startTime, dir.isRTL)}`);
  if (Number.isFinite(price)) parts.push(formatCurrencyAmount(price, currency, dir.isRTL));

  return (
    <FloatingCta>
      {parts.length > 0 ? (
        <Text
          style={[styles.caption, { color: colors.ink[700], fontFamily: f400, textAlign: 'center', writingDirection: dir.writingDirection }]}
        >
          {parts.join('  ·  ')}
        </Text>
      ) : null}
      <PrimaryButton
        label={t('booking.continue')}
        onPress={onConfirm}
        disabled={!selectedSlot}
        fontFamily={f700}
      />
    </FloatingCta>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: sawaaType.caption.fontSize + 1, lineHeight: sawaaType.caption.lineHeight + 2 },
});
