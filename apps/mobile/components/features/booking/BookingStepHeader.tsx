import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

const AR_DIGITS = ['١', '٢'] as const;
const TOTAL_STEPS = 2;

interface BookingStepHeaderProps {
  /** 1-based step within the 2-step booking flow. */
  step: 1 | 2;
  title: string;
  onBack: () => void;
}

/** Booking-wizard header: back + centred title, two progress segments and the step counter. */
export function BookingStepHeader({ step, title, onBack }: BookingStepHeaderProps) {
  const colors = useSawaaColors();
  const { t } = useTranslation();
  const dir = useDir();
  const stepText = t('booking.stepOfTwo', { step: dir.isRTL ? AR_DIGITS[step - 1] : step });

  return (
    <View style={{ gap: sawaaSpacing.md }}>
      <ScreenHeader title={title} onBack={onBack} />
      <View
        style={[styles.segments, { flexDirection: dir.row }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: TOTAL_STEPS, now: step }}
      >
        {[1, 2].map((n) => (
          <View
            key={n}
            style={[styles.segment, { backgroundColor: n <= step ? colors.teal[700] : withAlpha(colors.teal[700], 0.14) }]}
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
