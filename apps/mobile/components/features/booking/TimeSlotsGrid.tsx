import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { getSawaaRoles, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
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

export function slotGridLayout(width: number, fontScale: number): { columns: number; cellWidth: number } {
  const available = Math.max(0, width);
  const desired = fontScale >= 1.5 ? 2 : 3;
  const columns = Math.max(1, Math.min(desired, Math.floor((available + sawaaSpacing.sm) / (88 + sawaaSpacing.sm))));
  return { columns, cellWidth: Math.max(0, (available - (columns - 1) * sawaaSpacing.sm) / columns) };
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
  const { t } = useTranslation();
  const { width: windowWidth, fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(Math.max(0, windowWidth - 2 * sawaaSpacing.lg));
  const { cellWidth } = slotGridLayout(width, fontScale);
  const onLayout = (event: import('react-native').LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const sawaaColors = useSawaaColors();
  const { scheme } = useTheme();
  const roles = getSawaaRoles(scheme);
  if (loading) {
    return (
      <View onLayout={onLayout} style={[styles.slotsGrid, { flexDirection: dir.row }]}>
        {Array.from({ length: SKELETON_SLOTS }).map((_, i) => (
          <View key={i} style={{ width: cellWidth }}>
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
        actionLabel={onRetry ? t('common.retry') : undefined}
        onAction={onRetry}
      />
    );
  }

  if (slots.length === 0) {
    return (
      <EmptyState
        icon="calendar-outline"
        title={t('booking.slotsEmpty')}
        description={t('booking.slotsEmptyHint')}
      />
    );
  }

  return (
    <Animated.View
      onLayout={onLayout}
      entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(500).easing(Easing.out(Easing.cubic))}
      style={[styles.slotsGrid, { flexDirection: dir.row }]}
    >
      {slots.map((s, i) => {
        const isSelected = selectedIdx === i;
        return (
          <Pressable
            key={s.startTime}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(i);
            }}
            style={[styles.slot, { width: cellWidth,
              backgroundColor: isSelected ? roles.selection.fill : roles.surface,
              borderColor: isSelected ? roles.selection.fill : roles.surfaceHigh,
            }]}
            accessibilityRole="radio"
            accessibilityLabel={t('a11y.timeSlot', { time: formatTime(s.startTime, dir.isRTL) })}
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              style={[styles.slotText, {
                fontFamily: f600,
                color: isSelected ? roles.selection.foreground : sawaaColors.ink[900],
              }]}
            >
              {formatTime(s.startTime, dir.isRTL)}
            </Text>
            {isSelected ? <Check size={14} color={roles.selection.foreground} /> : null}
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slotsGrid: { flexWrap: 'wrap', gap: sawaaSpacing.sm },
  slot: {
    minHeight: 48,
    paddingHorizontal: sawaaSpacing.sm,
    paddingVertical: sawaaSpacing.sm,
    borderRadius: sawaaRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotText: {
    flexShrink: 1,
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    textAlign: 'center',
  },
});
