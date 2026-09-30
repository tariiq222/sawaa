import { LocalizedHorizontalScroll } from '@/components/ui/LocalizedHorizontalScroll';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { getSawaaRoles, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
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
  dayIdx: number | null;
  /** Null while loading or after a failed probe; dates without slots cannot be selected. */
  availabilityByDate?: Record<string, boolean> | null;
  onSelect: (idx: number) => void;
  dir: DirState;
  f500: string;
  f700: string;
}

/** Horizontal strip of 60pt day buttons; the selected day uses the `selection` role. */
export function DaySelector({ days, dayIdx, availabilityByDate, onSelect, dir, f500, f700 }: DaySelectorProps) {
  const colors = useSawaaColors();
  const { scheme } = useTheme();
  const roles = getSawaaRoles(scheme);
  const selectedDay = days[dayIdx ?? 0];
  const monthLabel = dir.isRTL
    ? `${MONTHS_AR[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`
    : `${MONTHS_EN[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.month, { fontFamily: f500, color: colors.ink[500], textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
        {monthLabel}
      </Text>
      <LocalizedHorizontalScroll
        dir={dir}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.daysRow, { flexDirection: dir.row }]}
      >
        {days.map((d, i) => {
          const isActive = i === dayIdx;
          const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const canSelect = availabilityByDate === undefined || availabilityByDate?.[dateKey] === true;
          const dow = d.getDay();
          return (
            <Pressable
              key={d.toISOString()}
              onPress={() => {
                if (!canSelect) return;
                Haptics.selectionAsync();
                onSelect(i);
              }}
              disabled={!canSelect}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive, disabled: !canSelect }}
              style={[
                styles.dayCell,
                {
                  backgroundColor: isActive ? roles.selection.fill : roles.surface,
                  borderColor: isActive ? roles.selection.fill : roles.surfaceHigh,
                  opacity: canSelect ? 1 : 0.4,
                },
              ]}
            >
              <Text style={[styles.dayName, { fontFamily: f500, color: isActive ? roles.selection.foreground : colors.ink[700] }]}>
                {dir.isRTL ? DAYS_AR_SHORT[dow] : DAYS_EN_SHORT[dow]}
              </Text>
              <Text style={[styles.dayNum, { fontFamily: f700, color: isActive ? roles.selection.foreground : colors.ink[900] }]}>
                {dir.isRTL ? d.getDate().toLocaleString('ar-SA') : d.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </LocalizedHorizontalScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: sawaaSpacing.sm },
  month: { fontSize: sawaaType.caption.fontSize + 1, lineHeight: sawaaType.caption.lineHeight + 2 },
  daysRow: { gap: sawaaSpacing.sm },
  dayCell: {
    width: 60,
    minHeight: 72,
    paddingVertical: sawaaSpacing.md,
    borderRadius: sawaaRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayName: { fontSize: sawaaType.caption.fontSize + 1, lineHeight: sawaaType.caption.lineHeight, textAlign: 'center' },
  dayNum: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight, marginTop: sawaaSpacing.xs, textAlign: 'center' },
});
