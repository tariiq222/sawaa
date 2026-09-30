import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export interface InfoRow {
  icon: LucideIcon;
  label: string;
  value: string;
}

/** One card of icon / label / value rows separated by hairlines (appointment, clinic and session details). */
export function InfoRows({ rows }: { rows: InfoRow[] }) {
  const colors = useSawaaColors();
  const dir = useDir();
  return (
    <Glass variant="base" radius={sawaaRadius.lg}>
      {rows.map((row, index) => {
        const Icon = row.icon;
        return (
          <View
            key={`${row.label}-${index}`}
            style={[
              styles.row,
              { flexDirection: dir.row },
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.ink[400] },
            ]}
          >
            <Icon size={22} color={colors.teal[700]} strokeWidth={1.75} />
            <Text style={[styles.label, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign }]}>{row.label}</Text>
            <Text style={[styles.value, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '600') }]}>{row.value}</Text>
          </View>
        );
      })}
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 52 },
  label: { flex: 1, fontSize: sawaaType.body.fontSize },
  value: { fontSize: 15 },
});
