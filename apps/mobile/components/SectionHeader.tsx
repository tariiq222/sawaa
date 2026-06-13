import React from 'react';
import { View, Text, StyleSheet, Pressable, StyleProp, ViewStyle } from 'react-native';

import { sawaaColors, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useDir } from '@/hooks/useDir';

type SectionHeaderProps = {
  title: string;
  size?: 'screen' | 'section';
  action?: { label: string; onPress: () => void };
  style?: StyleProp<ViewStyle>;
};

export function SectionHeader({
  title,
  size = 'section',
  action,
  style,
}: SectionHeaderProps) {
  const dir = useDir();
  const titleStyle = size === 'screen' ? styles.titleScreen : styles.titleSection;
  const accentStyle = size === 'screen' ? styles.accentScreen : styles.accentSection;

  return (
    <View
      style={[
        styles.row,
        { flexDirection: dir.row },
        style,
      ]}
    >
      <View style={[styles.labelWrap, { flexDirection: dir.row }]}>
        <View style={accentStyle} />
        <Text
          style={[
            titleStyle,
            { textAlign: dir.textAlign, writingDirection: dir.writingDirection },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8}>
          <Text style={styles.action}>{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sawaaSpacing.md,
    marginBottom: sawaaSpacing.md,
  },
  labelWrap: {
    alignItems: 'center',
    gap: sawaaSpacing.sm,
    flexShrink: 1,
  },
  accentScreen: {
    width: 3,
    height: sawaaSpacing['2xl'],
    borderRadius: 2,
    backgroundColor: sawaaColors.teal[700],
    opacity: 0.35,
  },
  accentSection: {
    width: 3,
    height: sawaaSpacing.xl,
    borderRadius: 2,
    backgroundColor: sawaaColors.teal[700],
    opacity: 0.35,
  },
  titleScreen: {
    fontSize: sawaaType.heading.fontSize,
    fontWeight: sawaaType.heading.weight,
    color: sawaaColors.teal[700],
    lineHeight: sawaaType.heading.lineHeight,
  },
  titleSection: {
    fontSize: sawaaType.subheading.fontSize,
    fontWeight: '700',
    color: sawaaColors.teal[700],
    lineHeight: sawaaType.subheading.lineHeight,
  },
  action: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    fontWeight: '700',
    color: sawaaColors.teal[700],
  },
});
