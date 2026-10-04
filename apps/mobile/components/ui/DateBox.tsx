import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useDir } from '@/hooks/useDir';
import { formatDayMonth } from '@/lib/session-format';
import { getFontName } from '@/theme/fonts';
import { sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface DateBoxProps {
  /** ISO date-time of the appointment or session. */
  iso: string | null | undefined;
  /** Shown instead of the day/month when the date is not known yet. */
  fallback: string;
}

/** Tinted day / month square at the start of appointment and group-session cards. */
export function DateBox({ iso, fallback }: DateBoxProps) {
  const colors = useSawaaColors();
  const dir = useDir();
  const parts = formatDayMonth(iso, dir.isRTL);
  const month = [styles.month, { color: colors.teal[700], fontFamily: getFontName(dir.locale, '500') }];
  return (
    <View style={[styles.box, { backgroundColor: colors.teal[50] }]}>
      {parts ? (
        <>
          <Text style={[styles.day, { color: colors.teal[700], fontFamily: getFontName(dir.locale, '700') }]}>{parts.day}</Text>
          <Text style={month}>{parts.month}</Text>
        </>
      ) : (
        <Text numberOfLines={2} style={month}>{fallback}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, flexShrink: 0 },
  day: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight, textAlign: 'center' },
  month: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight, textAlign: 'center' },
});
