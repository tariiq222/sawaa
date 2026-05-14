import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { sawaaColors } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
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
}

export function TimeSlotsGrid({
  loading,
  error,
  slots,
  selectedIdx,
  onSelect,
  dir,
  f500,
  f600,
  reduceMotion = false,
}: TimeSlotsGridProps) {
  if (loading) {
    return (
      <View style={styles.statusBlock}>
        <ActivityIndicator color={sawaaColors.teal[600]} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.statusBlock}>
        <Text style={[styles.statusText, { fontFamily: f500 }]}>{error}</Text>
      </View>
    );
  }

  if (slots.length === 0) {
    return (
      <View style={styles.statusBlock}>
        <Text style={[styles.statusText, { fontFamily: f500 }]}>
          {dir.isRTL ? 'لا توجد أوقات متاحة في هذا اليوم' : 'No available times on this day'}
        </Text>
      </View>
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
            <Glass variant={isSelected ? 'strong' : 'regular'} radius={16} style={styles.slot}>
              {isSelected ? (
                <LinearGradient
                  colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <Text
                style={[
                  styles.slotText,
                  { fontFamily: f600, color: isSelected ? '#fff' : sawaaColors.ink[900] },
                ]}
              >
                {formatTime(s.startTime, dir.isRTL)}
              </Text>
            </Glass>
          </Pressable>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slotsGrid: { flexWrap: 'wrap', gap: 8 },
  slotWrap: { width: '48.5%' },
  slot: { paddingVertical: 14, alignItems: 'center', overflow: 'hidden' },
  slotText: { fontSize: 13.5 },
  statusBlock: { paddingVertical: 32, alignItems: 'center', justifyContent: 'center' },
  statusText: { fontSize: 13, color: sawaaColors.ink[500] },
});
