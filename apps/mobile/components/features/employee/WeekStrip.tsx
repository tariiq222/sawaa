import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { getSawaaRoles, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { fromDateKey, getWeekDays } from '@/lib/employee-schedule';

interface WeekStripProps {
  /** Selected day as `YYYY-MM-DD`. The strip shows the Sunday to Saturday week around it. */
  selectedKey: string;
  onSelect: (key: string) => void;
  /** Pages the strip by whole weeks: -1 for the previous week, 1 for the next. */
  onShiftWeek: (direction: -1 | 1) => void;
}

/** Week day strip for the staff calendar; the selected day uses the `selection` role. */
export function WeekStrip({ selectedKey, onSelect, onShiftWeek }: WeekStripProps) {
  const colors = useSawaaColors();
  const { scheme } = useTheme();
  const { t } = useTranslation();
  const dir = useDir();
  const roles = getSawaaRoles(scheme);
  const locale = dir.isRTL ? 'ar-SA' : 'en-US';
  const week = useMemo(() => getWeekDays(selectedKey), [selectedKey]);
  const monthLabel = fromDateKey(selectedKey).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const Previous = dir.isRTL ? ChevronRight : ChevronLeft;
  const Next = dir.isRTL ? ChevronLeft : ChevronRight;

  return (
    <View style={styles.wrap}>
      <View style={[styles.header, { flexDirection: dir.row }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('doctor.previousWeek')}
          onPress={() => onShiftWeek(-1)}
          hitSlop={4}
          style={styles.arrow}
        >
          <Previous size={22} color={colors.ink[700]} strokeWidth={1.75} />
        </Pressable>
        <Text style={[styles.month, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700') }]}>
          {monthLabel}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('doctor.nextWeek')}
          onPress={() => onShiftWeek(1)}
          hitSlop={4}
          style={styles.arrow}
        >
          <Next size={22} color={colors.ink[700]} strokeWidth={1.75} />
        </Pressable>
      </View>
      <View style={[styles.days, { flexDirection: dir.row }]}>
        {week.map((day) => {
          const selected = day.key === selectedKey;
          const weekday = day.date.toLocaleDateString(locale, { weekday: 'short' });
          const dayNumber = day.date.toLocaleDateString(locale, { day: 'numeric' });
          return (
            <Pressable
              key={day.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={day.date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
              onPress={() => onSelect(day.key)}
              style={[
                styles.day,
                {
                  backgroundColor: selected ? roles.selection.fill : roles.surface,
                  borderColor: selected ? roles.selection.fill : roles.surfaceHigh,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.weekday, {
                  color: selected ? roles.selection.foreground : colors.ink[700],
                  fontFamily: getFontName(dir.locale, '400'),
                }]}
              >
                {weekday}
              </Text>
              <Text style={[styles.number, {
                color: selected ? roles.selection.foreground : colors.ink[900],
                fontFamily: getFontName(dir.locale, '700'),
              }]}
              >
                {dayNumber}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: sawaaSpacing.md },
  header: { alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  month: { flex: 1, textAlign: 'center', fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  days: { gap: 6 },
  day: {
    flex: 1,
    minHeight: 64,
    borderRadius: sawaaRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  weekday: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight },
  number: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
});
