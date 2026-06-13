import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { sawaaColors, sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa';
import { GlassSurface } from '@/theme/sawaa/GlassSurface';
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
    <GlassSurface variant="strong" radius={sawaaRadius.xl} padding={sawaaSpacing.md}>
      <View style={[styles.monthHead, { flexDirection: dir.row }]}>
        <View />
        <Text
          style={[
            styles.monthTitle,
            { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection },
          ]}
        >
          {monthLabel}
        </Text>
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
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
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
                  {
                    fontFamily: f500,
                    fontWeight: '500',
                    color: isActive ? withAlpha(sawaaColors.teal[50], 0.9) : sawaaColors.ink[700],
                  },
                ]}
              >
                {dir.isRTL ? DAYS_AR_SHORT[dow] : DAYS_EN_SHORT[dow]}
              </Text>
              <Text
                style={[
                  styles.dayNum,
                  { fontFamily: f700, color: isActive ? sawaaColors.teal[50] : sawaaColors.ink[900] },
                ]}
              >
                {dir.isRTL ? d.getDate().toLocaleString('ar-SA') : d.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  monthHead: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: sawaaSpacing.xs,
    paddingBottom: sawaaSpacing.md,
  },
  monthTitle: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: sawaaColors.ink[900],
  },
  daysRow: { gap: sawaaSpacing.sm, paddingHorizontal: sawaaSpacing.xs },
  dayCell: {
    width: 60,
    paddingVertical: sawaaSpacing.md,
    borderRadius: sawaaRadius.md,
    alignItems: 'center',
    overflow: 'hidden',
  },
  dayCellInactive: {
    backgroundColor: sawaaColors.glass.bgStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: sawaaColors.glass.border,
  },
  dayName: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    opacity: 0.85,
  },
  dayNum: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    marginTop: sawaaSpacing.xs,
  },
});
