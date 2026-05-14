import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import type { DirState } from '@/hooks/useDir';

const DAYS_AR_SHORT = ['أحد', 'إث', 'ثل', 'أر', 'خم', 'جم', 'سب'];
const DAYS_EN_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const MONTHS_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface DaySelectorProps {
  days: Date[];
  dayIdx: number;
  onSelect: (idx: number) => void;
  dir: DirState;
  f500: string;
  f700: string;
}

export function DaySelector({ days, dayIdx, onSelect, dir, f500, f700 }: DaySelectorProps) {
  const selectedDay = days[dayIdx];
  const monthLabel = dir.isRTL
    ? `${MONTHS_AR[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`
    : `${MONTHS_EN[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`;

  return (
    <Glass variant="strong" radius={sawaaRadius.xl} style={styles.monthCard}>
      <View style={[styles.monthHead, { flexDirection: dir.row }]}>
        <View />
        <Text style={[styles.monthTitle, { fontFamily: f700 }]}>{monthLabel}</Text>
        <View />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.daysRow, { flexDirection: dir.row }]}
      >
        {days.map((d, i) => {
          const isActive = i === dayIdx;
          const dow = d.getDay();
          return (
            <Pressable
              key={d.toISOString()}
              onPress={() => {
                Haptics.selectionAsync();
                onSelect(i);
              }}
              style={[styles.dayCell, !isActive && styles.dayCellInactive]}
            >
              {isActive ? (
                <LinearGradient
                  colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              ) : null}
              <Text
                style={[
                  styles.dayName,
                  { fontFamily: f500, color: isActive ? 'rgba(255,255,255,0.9)' : sawaaColors.ink[700] },
                ]}
              >
                {dir.isRTL ? DAYS_AR_SHORT[dow] : DAYS_EN_SHORT[dow]}
              </Text>
              <Text
                style={[
                  styles.dayNum,
                  { fontFamily: f700, color: isActive ? '#fff' : sawaaColors.ink[900] },
                ]}
              >
                {dir.isRTL ? d.getDate().toLocaleString('ar-SA') : d.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Glass>
  );
}

const styles = StyleSheet.create({
  monthCard: { padding: 12 },
  monthHead: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 10,
  },
  monthTitle: { fontSize: 13.5, color: sawaaColors.ink[900] },
  daysRow: { gap: 8, paddingHorizontal: 4 },
  dayCell: {
    width: 60,
    paddingVertical: 10,
    borderRadius: 16,
    alignItems: 'center',
    overflow: 'hidden',
  },
  dayCellInactive: {
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  dayName: { fontSize: 10.5, opacity: 0.85 },
  dayNum: { fontSize: 17, marginTop: 2 },
});
