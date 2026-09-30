import { LocalizedHorizontalScroll } from '@/components/ui/LocalizedHorizontalScroll';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
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
  dayIdx: number | null;
  /** Null while loading or after a failed probe; dates without slots cannot be selected. */
  availabilityByDate?: Record<string, boolean> | null;
  onSelect: (idx: number) => void;
  dir: DirState;
  f500: string;
  f700: string;
}

export function DaySelector({ days, dayIdx, availabilityByDate, onSelect, dir, f500, f700 }: DaySelectorProps) {
  const sawaaColors = useSawaaColors();
  const styles = React.useMemo(() => createStyles(sawaaColors), [sawaaColors]);
  const selectedDay = days[dayIdx ?? 0];
  const monthLabel = dir.isRTL
    ? `${MONTHS_AR[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`
    : `${MONTHS_EN[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`;

  return (
    <Glass variant="strong" radius={sawaaRadius.xl} padding={sawaaSpacing.md}>
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
            <Glass
              key={d.toISOString()}
              onPress={() => {
                if (!canSelect) return;
                Haptics.selectionAsync();
                onSelect(i);
              }}
              disabled={!canSelect}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive, disabled: !canSelect }}
              variant={isActive ? 'strong' : 'regular'}
              radius={sawaaRadius.md}
              tint={isActive ? withAlpha(sawaaColors.teal[600], 0.16) : undefined}
              style={[styles.dayCell, isActive && styles.dayCellActive, !canSelect && styles.dayCellUnavailable]}
            >
              <Text
                style={[
                  styles.dayName,
                  {
                    fontFamily: f500,
                    fontWeight: '500',
                    color: isActive ? sawaaColors.teal[700] : sawaaColors.ink[700],
                  },
                ]}
              >
                {dir.isRTL ? DAYS_AR_SHORT[dow] : DAYS_EN_SHORT[dow]}
              </Text>
              <Text
                style={[
                  styles.dayNum,
                  { fontFamily: f700, color: isActive ? sawaaColors.teal[700] : sawaaColors.ink[900] },
                ]}
              >
                {dir.isRTL ? d.getDate().toLocaleString('ar-SA') : d.getDate()}
              </Text>
            </Glass>
          );
        })}
      </LocalizedHorizontalScroll>
    </Glass>
  );
}

const createStyles = (sawaaColors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
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
    textAlign: 'center',
  },
  daysRow: { gap: sawaaSpacing.sm, paddingHorizontal: sawaaSpacing.xs },
  dayCell: {
    width: 60,
    paddingVertical: sawaaSpacing.md,
    borderRadius: sawaaRadius.md,
    alignItems: 'center',
    overflow: 'hidden',
  },
  dayCellActive: { borderWidth: 1.5, borderColor: sawaaColors.teal[600] },
  dayCellUnavailable: { opacity: 0.35 },
  dayName: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    opacity: 0.85,
    textAlign: 'center',
  },
  dayNum: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    marginTop: sawaaSpacing.xs,
    textAlign: 'center',
  },
});
