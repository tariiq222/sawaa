import { LocalizedHorizontalScroll } from '@/components/ui/LocalizedHorizontalScroll';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { getSawaaRoles, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import type { DirState } from '@/hooks/useDir';

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
  const locale = dir.isRTL ? 'ar-SA' : 'en-US';
  const monthLabel = selectedDay ? new Intl.DateTimeFormat(locale, { calendar: 'gregory', month: 'short', year: 'numeric' }).format(selectedDay) : '';

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
          const dayLabel = new Intl.DateTimeFormat(locale, { calendar: 'gregory', weekday: 'short' }).format(d);
          const fullDateLabel = new Intl.DateTimeFormat(locale, { calendar: 'gregory', dateStyle: 'full' }).format(d);
          return (
            <Pressable
              key={d.toISOString()}
              onPress={() => {
                if (!canSelect) return;
                Haptics.selectionAsync();
                onSelect(i);
              }}
              disabled={!canSelect}
              accessibilityRole="radio"
              accessibilityLabel={fullDateLabel}
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
                {dayLabel}
              </Text>
              <Text style={[styles.dayNum, { fontFamily: f700, color: isActive ? roles.selection.foreground : colors.ink[900] }]}>
                {dir.isRTL ? d.getDate().toLocaleString('ar-SA') : d.getDate()}
              </Text>
              {isActive ? <Check size={14} color={roles.selection.foreground} /> : null}
            </Pressable>
          );
        })}
      </LocalizedHorizontalScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: sawaaSpacing.sm },
  month: { fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight },
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
  dayName: { fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.caption.lineHeight, textAlign: 'center' },
  dayNum: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight, marginTop: sawaaSpacing.xs, textAlign: 'center' },
});
