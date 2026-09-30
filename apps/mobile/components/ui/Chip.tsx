import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { getSawaaRoles, sawaaRadius } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

/** Filter / choice chip. 44pt high; the selected state uses the `selection` role. */
export function Chip({ label, selected = false, onPress, disabled = false }: ChipProps) {
  const colors = useSawaaColors();
  const { scheme } = useTheme();
  const dir = useDir();
  const roles = getSawaaRoles(scheme);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? roles.selection.fill : roles.surface,
          borderColor: selected ? roles.selection.fill : roles.surfaceHigh,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.label, {
          color: selected ? roles.selection.foreground : colors.ink[900],
          fontFamily: getFontName(dir.locale, '600'),
        }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: sawaaRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 14 },
});
