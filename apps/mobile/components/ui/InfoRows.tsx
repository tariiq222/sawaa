import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaSpacing, sawaaType, getSawaaRoles } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';

export interface InfoRow {
  icon: LucideIcon;
  label: string;
  value: string;
}

/** One card of icon / label / value rows separated by hairlines (appointment, clinic and session details). */
export function InfoRows({ rows, layout = 'inline' }: { rows: InfoRow[]; layout?: 'inline' | 'stacked' }) {
  const colors = useSawaaColors();
  const dir = useDir();
  const { scheme } = useTheme();
  const stacked = layout === 'stacked';
  const roles = getSawaaRoles(scheme);
  return (
    <Glass variant="base" radius={stacked ? sawaaRadius.xl : sawaaRadius.lg}>
      {rows.map((row, index) => {
        const Icon = row.icon;
        return (
          <View
            key={`${row.label}-${index}`}
            style={[
              styles.row,
              stacked && styles.stackedRow,
              { flexDirection: dir.row },
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: stacked ? roles.surfaceHigh : colors.ink[400] },
            ]}
          >
            {stacked ? (
              <>
                <View style={[styles.iconBox, { backgroundColor: colors.teal[50] }]}>
                  <Icon size={20} color={colors.teal[700]} strokeWidth={1.75} />
                </View>
                <View style={styles.textBlock}>
                  <Text style={[styles.stackedLabel, { color: colors.ink[500], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>{row.label}</Text>
                  <Text style={[styles.stackedValue, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '600'), textAlign: dir.textAlign, writingDirection: 'auto' }]}>{row.value}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={{ flexShrink: 0 }}><Icon size={22} color={colors.teal[700]} strokeWidth={1.75} /></View>
                <Text style={[styles.label, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>{row.label}</Text>
                <Text style={[styles.value, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '600'), textAlign: dir.textAlign, writingDirection: 'auto' }]}>{row.value}</Text>
              </>
            )}
          </View>
        );
      })}
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 52 },
  label: { flex: 1, minWidth: 0, maxWidth: '42%', fontSize: sawaaType.body.fontSize },
  value: { flex: 1, minWidth: 0, flexShrink: 1, fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  stackedRow: { padding: sawaaSpacing.lg, minHeight: 72 },
  iconBox: { width: 40, height: 40, borderRadius: sawaaRadius.sm, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  textBlock: { flex: 1, minWidth: 0, gap: sawaaSpacing.xs },
  stackedLabel: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight },
  stackedValue: { fontSize: sawaaType.body.fontSize + 1, lineHeight: sawaaType.subheading.lineHeight },
});
