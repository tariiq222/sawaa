import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { BackButton } from '@/components/ui/BackButton';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

const AR_DIGITS = ['١', '٢', '٣'] as const;
const TOTAL_STEPS = 3;

interface BookingStepHeaderProps {
  /** 1-based step within the 3-step booking flow. */
  step: 1 | 2 | 3;
  onBack: () => void;
  backAccessibilityLabel?: string;
}

/**
 * Shared booking-wizard header: glass back button, step counter, and the
 * shared determinate ProgressBar (replaces the per-screen inline bars).
 */
export function BookingStepHeader({ step, onBack, backAccessibilityLabel }: BookingStepHeaderProps) {
  const sawaaColors = useSawaaColors();
  const styles = React.useMemo(() => createStyles(sawaaColors), [sawaaColors]);
  const dir = useDir();
  const f600 = getFontName(dir.locale, '600');
  const label = dir.isRTL
    ? `خطوة ${AR_DIGITS[step - 1]} من ${AR_DIGITS[TOTAL_STEPS - 1]}`
    : `Step ${step} of ${TOTAL_STEPS}`;

  return (
    <View style={{ gap: sawaaSpacing.sm }}>
      <View
        style={{
          flexDirection: dir.row,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <BackButton onPress={onBack} accessibilityLabel={backAccessibilityLabel} />
        <Text
          style={[styles.label, {
            fontFamily: f600,
            textAlign: dir.textAlign,
            writingDirection: dir.writingDirection,
          }]}
        >
          {label}
        </Text>
      </View>
      <ProgressBar progress={step / TOTAL_STEPS} />
    </View>
  );
}

const createStyles = (sawaaColors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  label: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    fontWeight: '600',
    color: sawaaColors.ink[500],
  },
});
