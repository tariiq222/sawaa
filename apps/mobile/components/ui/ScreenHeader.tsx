import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/ui/BackButton';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface ScreenHeaderProps {
  title: string;
  onBack: () => void;
  /** Optional control on the logical end edge. Keeps the title centred when absent. */
  end?: React.ReactNode;
}

/**
 * Header for pushed screens: back button on the start edge, centred title, and
 * an end slot of the same width so the title stays centred. Tab-root screens
 * use a large start-aligned title instead and have no back button.
 */
export function ScreenHeader({ title, onBack, end }: ScreenHeaderProps) {
  const colors = useSawaaColors();
  const dir = useDir();
  return (
    <View style={[styles.row, { flexDirection: dir.row }]}>
      <BackButton onPress={onBack} style={styles.slot} />
      <Text
        accessibilityRole="header"
        numberOfLines={2}
        style={[styles.title, { color: colors.ink[900], fontFamily: getFontName(dir.locale, sawaaType.subheading.weight), writingDirection: dir.writingDirection }]}
      >
        {title}
      </Text>
      <View style={styles.slot}>{end}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  slot: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'auto' },
  title: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
  },
});
