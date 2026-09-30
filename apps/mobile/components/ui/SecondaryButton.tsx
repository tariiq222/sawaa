import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface SecondaryButtonProps {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

/** Outlined capsule for the less prominent of two actions; PrimaryButton is the filled one. */
export function SecondaryButton({ label, onPress, disabled = false, height = 56, style }: SecondaryButtonProps) {
  const colors = useSawaaColors();
  const dir = useDir();
  const inactive = disabled || !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={[styles.button, { height, borderColor: colors.teal[700], opacity: inactive ? 0.55 : 1 }, style]}
    >
      <Text style={[styles.label, { color: colors.teal[700], fontFamily: getFontName(dir.locale, '700') }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: sawaaRadius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  label: { fontSize: 17 },
});
