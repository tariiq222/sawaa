import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatTimeOfDay } from '@/lib/session-format';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
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
  return formatTimeOfDay(iso, isRTL) ?? '—';
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
  const { t } = useTranslation();
  const { scheme } = useTheme();
  const roles = getSawaaRoles(scheme);
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
        actionLabel={onRetry ? (t('common.retry')) : undefined}
        onAction={onRetry}
      />
    );
  }

  if (slots.length === 0) {
    return (
      <EmptyState
        icon="calendar-outline"
        title={t('booking.noSlotsForDay')}
        description={t('booking.chooseAnotherDay')}
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
          <Pressable
            key={s.startTime}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(i);
            }}
            style={[styles.slotWrap, styles.slot, {
              backgroundColor: isSelected ? roles.selection.fill : roles.surface,
              borderColor: isSelected ? roles.selection.fill : roles.surfaceHigh,
            }]}
            accessibilityRole="button"
            accessibilityLabel={t('booking.slotTime', { time: formatTime(s.startTime, dir.isRTL) })}
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
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slotsGrid: { flexWrap: 'wrap', gap: sawaaSpacing.sm },
  slotWrap: { width: '31.5%' },
  slot: {
    minHeight: 48,
    borderRadius: sawaaRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotText: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    textAlign: 'center',
  },
});
