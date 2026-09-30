import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface OutlineButtonProps {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  /** `brand` for navigation-style actions, `neutral` for the quiet action next to a primary one. */
  tone?: 'brand' | 'neutral';
  disabled?: boolean;
}

/** Secondary action: 56pt outlined capsule. Never the primary action on a screen. */
export function OutlineButton({ label, onPress, icon, tone = 'brand', disabled = false }: OutlineButtonProps) {
  const colors = useSawaaColors();
  const dir = useDir();
  const fg = tone === 'brand' ? colors.teal[700] : colors.ink[900];
  const border = tone === 'brand' ? colors.teal[700] : colors.ink[500];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { flexDirection: dir.row, borderColor: border, opacity: disabled ? 0.45 : pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.label, { color: fg, fontFamily: getFontName(dir.locale, '600') }]}>{label}</Text>
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: sawaaRadius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: { fontSize: 17 },
});
