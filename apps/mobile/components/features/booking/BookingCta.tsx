import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Glass } from '@/theme/components/Glass';
import { FloatingActionBar } from '@/components/ui/FloatingActionBar';
import { useReduceMotion } from '@/hooks/useA11y';
import type { DirState } from '@/hooks/useDir';
import { formatTime, type Slot } from './TimeSlotsGrid';

const DAYS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface BookingCtaProps {
  selectedDay: Date;
  selectedSlot: Slot | null;
  onConfirm: () => void;
  dir: DirState;
  f400: string;
  f700: string;
}

export function BookingCta({
  selectedDay,
  selectedSlot,
  onConfirm,
  dir,
  f400,
  f700,
}: BookingCtaProps) {
  const sawaaColors = useSawaaColors();
  const styles = React.useMemo(() => createStyles(sawaaColors), [sawaaColors]);
  const reduceMotion = useReduceMotion();
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;
  const dayLabel = dir.isRTL ? DAYS_AR[selectedDay.getDay()] : DAYS_EN_SHORT[selectedDay.getDay()];
  const dayNum = dir.isRTL ? selectedDay.getDate().toLocaleString('ar-SA') : selectedDay.getDate();

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(420).duration(700).easing(Easing.out(Easing.cubic))}
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      <FloatingActionBar>
        <View style={styles.summary}>
          <Text
            style={[
              styles.summaryTop,
              { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {selectedSlot
              ? `${dayLabel} ${dayNum} · ${formatTime(selectedSlot.startTime, dir.isRTL)}`
              : dir.isRTL
                ? 'اختاري وقتاً'
                : 'Pick a time'}
          </Text>
          <Text
            style={[
              styles.summaryBot,
              { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection },
            ]}
          >
            {dir.isRTL ? 'تأمين مقبول' : 'Insurance accepted'}
          </Text>
        </View>
        <Glass
          radius={23}
          interactive
          accessibilityLabel={dir.isRTL ? 'تأكيد' : 'Confirm'}
          accessibilityState={{ disabled: !selectedSlot }}
          onPress={onConfirm}
          disabled={!selectedSlot}
          style={[styles.confirmArrow, { opacity: selectedSlot ? 1 : 0.45 }]}
        >
          <GoIcon size={23} color={sawaaColors.ink[900]} strokeWidth={2} />
        </Glass>
      </FloatingActionBar>
    </Animated.View>
  );
}

const createStyles = (sawaaColors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  confirmArrow: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  summary: { flex: 1, paddingHorizontal: sawaaSpacing.sm },
  summaryTop: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: sawaaColors.ink[500],
  },
  summaryBot: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: sawaaColors.ink[900],
    marginTop: sawaaSpacing.xs,
  },
});
