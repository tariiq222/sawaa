import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { sawaaColors, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { GlassSurface } from '@/theme/sawaa/GlassSurface';
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
  const mm = String(m).padStart(2, '0');
  return `${h12}:${mm} ${suffix}`;
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
          <Pressable
            key={s.startTime}
            onPress={() => {
              Haptics.selectionAsync();
              onSelect(i);
            }}
            style={styles.slotWrap}
            accessibilityRole="button"
            accessibilityLabel={`${dir.isRTL ? 'وقت' : 'Time'} ${formatTime(s.startTime, dir.isRTL)}`}
            accessibilityState={{ selected: isSelected }}
          >
            <GlassSurface variant={isSelected ? 'strong' : 'base'} radius={sawaaRadius.md} style={styles.slot}>
              {isSelected ? (
                <LinearGradient
                  colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <View style={styles.slotInner}>
                <Text
                  style={[
                    styles.slotText,
                    {
                      fontFamily: f600,
                      fontWeight: '600',
                      color: isSelected ? sawaaColors.teal[50] : sawaaColors.ink[900],
                    },
                  ]}
                >
                  {formatTime(s.startTime, dir.isRTL)}
                </Text>
              </View>
            </GlassSurface>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slotsGrid: { flexWrap: 'wrap', gap: sawaaSpacing.sm },
  slotWrap: { width: '48.5%' },
  slot: { overflow: 'hidden' },
  slotInner: { paddingVertical: sawaaSpacing.lg, alignItems: 'center' },
  slotText: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
  },
});
