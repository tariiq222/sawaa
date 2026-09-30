import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Glass } from '@/theme/components/Glass';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import type { DirState } from '@/hooks/useDir';

export interface Slot {
  startTime: string;
  endTime: string;
}

export function formatTime(iso: string, isRTL: boolean): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h < 12 ? (isRTL ? 'ص' : 'AM') : isRTL ? 'م' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const locale = isRTL ? 'ar-SA-u-nu-arab' : 'en-US';
  const hour = new Intl.NumberFormat(locale, { useGrouping: false }).format(h12);
  const minute = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }).format(m);
  return `${hour}:${minute} ${suffix}`;
}

const SKELETON_SLOTS = 6;
const SLOT_SKELETON_HEIGHT = 48;

interface TimeSlotsGridProps {
  loading: boolean;
  error: string | null;
  slots: Slot[];
  selectedIdx: number | null;
  onSelect: (idx: number) => void;
  dir: DirState;
  f500: string;
  f600: string;
  reduceMotion?: boolean;
  onRetry?: () => void;
}

export function TimeSlotsGrid({
  loading,
  error,
  slots,
  selectedIdx,
  onSelect,
  dir,
  f600,
  reduceMotion = false,
  onRetry,
}: TimeSlotsGridProps) {
  const sawaaColors = useSawaaColors();
  const styles = React.useMemo(() => createStyles(sawaaColors), [sawaaColors]);
  if (loading) {
    return (
      <View style={[styles.slotsGrid, { flexDirection: dir.row }]}>
        {Array.from({ length: SKELETON_SLOTS }).map((_, i) => (
          <View key={i} style={styles.slotWrap}>
            <Skeleton height={SLOT_SKELETON_HEIGHT} radius={sawaaRadius.md} />
          </View>
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <EmptyState
        icon="cloud-offline-outline"
        tone="danger"
        title={error}
        actionLabel={onRetry ? (dir.isRTL ? 'إعادة المحاولة' : 'Retry') : undefined}
        onAction={onRetry}
      />
    );
  }

  if (slots.length === 0) {
    return (
      <EmptyState
        icon="calendar-outline"
        title={dir.isRTL ? 'لا مواعيد متاحة في هذا اليوم' : 'No appointments available on this day'}
        description={dir.isRTL ? 'جرب اختيار يوم آخر من التقويم' : 'Try picking another day from the calendar'}
      />
    );
  }

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(500).easing(Easing.out(Easing.cubic))}
      style={[styles.slotsGrid, { flexDirection: dir.row }]}
    >
      {slots.map((s, i) => {
        const isSelected = selectedIdx === i;
        return (
          <Glass
            key={s.startTime}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(i);
            }}
            variant={isSelected ? 'strong' : 'clear'}
            radius={sawaaRadius.md}
            tint={withAlpha(sawaaColors.teal[600], isSelected ? 0.22 : 0.09)}
            style={[styles.slotWrap, styles.slot, isSelected && styles.slotSelected]}
            accessibilityRole="button"
            accessibilityLabel={`${dir.isRTL ? 'وقت' : 'Time'} ${formatTime(s.startTime, dir.isRTL)}`}
            accessibilityState={{ selected: isSelected }}
          >
            <View style={styles.slotInner}>
                <Text
                  style={[
                    styles.slotText,
                    isSelected && styles.slotTextSelected,
                    {
                      fontFamily: f600,
                      fontWeight: '600',
                    },
                  ]}
                >
                  {formatTime(s.startTime, dir.isRTL)}
                </Text>
            </View>
          </Glass>
        );
      })}
    </Animated.View>
  );
}

const createStyles = (sawaaColors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  slotsGrid: { flexWrap: 'wrap', gap: sawaaSpacing.sm },
  slotWrap: { width: '48.5%' },
  slot: { overflow: 'hidden', backgroundColor: sawaaColors.glass.opaqueBg, borderRadius: sawaaRadius.md },
  slotSelected: { borderWidth: 1.5, borderColor: sawaaColors.teal[600] },
  slotInner: { paddingVertical: sawaaSpacing.lg, alignItems: 'center' },
  slotTextSelected: { color: sawaaColors.teal[700] },
  slotText: {
    color: sawaaColors.ink[900],
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    textAlign: 'center',
  },
});
