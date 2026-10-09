import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';

import { Glass } from '@/theme/components/Glass';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export interface MenuEntry {
  key: string;
  icon: LucideIcon;
  label: string;
  /** Secondary line under the label. */
  description?: string;
  /** Trailing read-only value such as a version number or phone. */
  value?: string;
  /** Values like phone numbers and versions stay left-to-right in Arabic. */
  valueDirection?: 'ltr' | 'auto';
  onPress?: () => void;
  /** Trailing control (for example a switch). Replaces the chevron. */
  trailing?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  busy?: boolean;
}

/**
 * The single list-row pattern for account, settings and about screens: one
 * card, hairline-separated rows, a 22pt icon on the start edge and a chevron
 * on rows that navigate. Rows without `onPress` render as read-only.
 */
export function MenuGroup({ title, entries, footer }: { title?: string; entries: MenuEntry[]; footer?: React.ReactNode }) {
  const colors = useSawaaColors();
  return (
    <View style={styles.section}>
      {title ? <SectionHeader title={title} /> : null}
      <Glass variant="strong" radius={sawaaRadius.lg} padding={0}>
        {entries.map((entry, index) => (
          <View key={entry.key} style={index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.ink[400] } : undefined}>
            <MenuRow {...entry} />
          </View>
        ))}
        {footer}
      </Glass>
    </View>
  );
}

function MenuRow({ icon: Icon, label, description, value, valueDirection = 'auto', onPress, trailing, danger, disabled, busy }: MenuEntry) {
  const colors = useSawaaColors();
  const dir = useDir();
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;
  const tint = danger ? colors.accent.coral : colors.teal[700];
  const content = (
    <>
      <View style={styles.icon}><Icon size={22} color={tint} strokeWidth={1.75} /></View>
      <View style={styles.text}>
        <Text style={[styles.label, { color: danger ? colors.accent.coral : colors.ink[900], fontFamily: getFontName(dir.locale, '600'), textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
          {label}
        </Text>
        {description ? (
          <Text style={[styles.description, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {description}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={[styles.value, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), writingDirection: valueDirection === 'ltr' ? 'ltr' : dir.writingDirection }]}>
          {value}
        </Text>
      ) : null}
      {busy ? <ActivityIndicator color={tint} /> : null}
      {trailing}
      {onPress && !trailing && !danger ? <Chevron size={18} color={colors.ink[500]} strokeWidth={2} /> : null}
    </>
  );

  if (!onPress) {
    return <View style={[styles.row, { flexDirection: dir.row }]}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
      style={({ pressed }) => [styles.row, { flexDirection: dir.row, opacity: pressed ? 0.7 : disabled ? 0.55 : 1 }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: sawaaSpacing.md },
  row: { alignItems: 'center', gap: 14, paddingHorizontal: sawaaSpacing.lg, paddingVertical: sawaaSpacing.sm, minHeight: 56 },
  icon: { flexShrink: 0 },
  text: { flex: 1, minWidth: 0, flexShrink: 1 },
  label: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  description: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight },
  value: { flexShrink: 1, maxWidth: '45%', fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
});
