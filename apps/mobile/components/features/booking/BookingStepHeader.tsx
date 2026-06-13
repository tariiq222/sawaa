import React from 'react';
import { Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaColors, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';

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
  const dir = useDir();
  const f600 = getFontName(dir.locale, '600');
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
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
        <Glass
          variant="strong"
          radius={sawaaRadius.pill}
          onPress={onBack}
          interactive
          accessibilityLabel={backAccessibilityLabel}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <BackIcon size={22} color={sawaaColors.ink[700]} strokeWidth={1.75} />
        </Glass>
        <Text
          style={{
            fontSize: sawaaType.caption.fontSize,
            lineHeight: sawaaType.caption.lineHeight,
            fontFamily: f600,
            fontWeight: '600',
            color: sawaaColors.ink[500],
            textAlign: dir.textAlign,
            writingDirection: dir.writingDirection,
          }}
        >
          {label}
        </Text>
      </View>
      <ProgressBar progress={step / TOTAL_STEPS} />
    </View>
  );
}
