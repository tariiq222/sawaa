import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface BookingStepHeaderProps {
  /** 1-based step within the booking flow. */
  step: number;
  total: number;
  title: string;
  onBack: () => void;
}

/** Booking-wizard header: back + centred title, progress segments and the step counter. */
export function BookingStepHeader({ step, total, title, onBack }: BookingStepHeaderProps) {
  const colors = useSawaaColors();
  const { t } = useTranslation();
  const dir = useDir();
  const fmt = (n: number) => (dir.isRTL ? n.toLocaleString('ar-SA') : String(n));
  const stepText = t('booking.stepOf', { step: fmt(step), total: fmt(total) });

  return (
    <View style={{ gap: sawaaSpacing.md }}>
      <ScreenHeader title={title} onBack={onBack} />
      <View
        style={[styles.segments, { flexDirection: dir.row }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: total, now: step }}
      >
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[styles.segment, { backgroundColor: i < step ? colors.teal[700] : withAlpha(colors.teal[700], 0.14) }]}
          />
        ))}
      </View>
      <Text
        style={[styles.label, {
          color: colors.ink[500],
          fontFamily: getFontName(dir.locale, '500'),
          textAlign: dir.textAlign,
          writingDirection: dir.writingDirection,
        }]}
      >
        {stepText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  segments: { gap: 8 },
  segment: { flex: 1, height: 4, borderRadius: sawaaRadius.pill },
  label: { fontSize: sawaaType.caption.fontSize + 1, lineHeight: sawaaType.caption.lineHeight + 2 },
});
