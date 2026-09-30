import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface SectionHeaderProps {
  title: string;
  /** Text of the trailing action, e.g. "view all". Omit for a plain heading. */
  actionLabel?: string;
  onActionPress?: () => void;
}

/** Section heading: 18 / 24 bold title with an optional 44pt-high trailing action. */
export function SectionHeader({ title, actionLabel, onActionPress }: SectionHeaderProps) {
  const colors = useSawaaColors();
  const dir = useDir();
  return (
    <View style={[styles.row, { flexDirection: dir.row }]}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign }]}
      >
        {title}
      </Text>
      {actionLabel && onActionPress ? (
        <Pressable accessibilityRole="button" onPress={onActionPress} style={styles.action} hitSlop={8}>
          <Text style={[styles.actionText, { color: colors.teal[700], fontFamily: getFontName(dir.locale, '600') }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', justifyContent: 'space-between' },
  title: { flexShrink: 1, fontSize: sawaaType.subheading.fontSize + 2, lineHeight: sawaaType.subheading.lineHeight },
  action: { minHeight: 44, justifyContent: 'center' },
  actionText: { fontSize: sawaaType.body.fontSize },
});
