import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';

import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { getSawaaRoles } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';

/** Labelled checkbox: drawn box + text, exposed as a single checkbox to screen readers. */
export function CheckboxRow({ label, checked, onChange, disabled }: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const dir = useDir();
  const colors = useSawaaColors();
  const { scheme } = useTheme();
  const roles = getSawaaRoles(scheme);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={[styles.row, { flexDirection: dir.row }]}
    >
      <View style={[styles.box, { borderColor: checked ? roles.selection.fill : colors.ink[500] },
        checked && { backgroundColor: roles.selection.fill }]}>
        {checked ? <Check size={14} color={roles.selection.foreground} strokeWidth={3} /> : null}
      </View>
      <Text style={[styles.label, { color: colors.ink[900], fontFamily: getFontName(dir.locale), writingDirection: dir.writingDirection, textAlign: dir.textAlign }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, alignItems: 'center', gap: 12 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1 },
});
