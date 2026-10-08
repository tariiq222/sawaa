import React, { useState } from 'react';
import { Pressable, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TextStyle, View } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { getSawaaRoles, sawaaTokens } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import type { DirState } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';

interface LabeledInputProps extends Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  error?: string;
  disabled?: boolean;
  inputStyle?: StyleProp<TextStyle>;
  showVisibilityToggle?: boolean;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  dir: DirState;
  /** Compatibility slot for the unconsumed ThemedInput adapter. */
  suffixIcon?: React.ReactNode;
  onSuffixPress?: () => void;
}

export function LabeledInput({ label, value, onChangeText, error, disabled, inputStyle,
  secureTextEntry, showVisibilityToggle, isVisible, onToggleVisibility, dir,
  suffixIcon, onSuffixPress, onFocus, onBlur, editable: nativeEditable, readOnly, ...inputProps }: LabeledInputProps) {
  const colors = useSawaaColors();
  const { theme, scheme } = useTheme();
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const editable = !disabled && nativeEditable !== false && readOnly !== true;
  const direction = { textAlign: dir.textAlign, writingDirection: dir.writingDirection };
  const fontFamily = getFontName(dir.locale);
  return <View style={styles.field}>
    {label ? <Text style={[styles.label, direction, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700') }]}>{label}</Text> : null}
    <View style={[styles.input, { backgroundColor: colors.glass.opaqueBg, flexDirection: dir.row,
      borderColor: error ? theme.colors.error : focused ? getSawaaRoles(scheme).focus : colors.teal[200] }]}>
      <TextInput {...inputProps} value={value} onChangeText={onChangeText} editable={editable} readOnly={!editable}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        placeholderTextColor={inputProps.placeholderTextColor ?? colors.ink[500]}
        secureTextEntry={secureTextEntry && !isVisible}
        onFocus={event => { setFocused(true); onFocus?.(event); }}
        onBlur={event => { setFocused(false); onBlur?.(event); }}
        style={[styles.inputText, { color: colors.ink[900], fontFamily }, direction, inputStyle]} />
      {showVisibilityToggle ? <Pressable accessibilityRole="button"
        accessibilityLabel={t(isVisible ? 'common.hidePassword' : 'common.showPassword')}
        accessibilityState={{ disabled: !editable || !onToggleVisibility, checked: Boolean(isVisible) }}
        disabled={!editable || !onToggleVisibility} onPress={onToggleVisibility} style={styles.eyeBtn}>
        {isVisible ? <Eye size={20} color={colors.ink[500]} strokeWidth={1.75} />
          : <EyeOff size={20} color={colors.ink[500]} strokeWidth={1.75} />}
      </Pressable> : suffixIcon ? <Pressable accessibilityRole={onSuffixPress ? 'button' : undefined}
        disabled={!editable || !onSuffixPress} onPress={onSuffixPress} style={styles.eyeBtn}>{suffixIcon}</Pressable> : null}
    </View>
    {error ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite"
      style={[styles.error, direction, { color: theme.colors.error, fontFamily }]}>{error}</Text> : null}
  </View>;
}
const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 14, lineHeight: 20 },
  input: { minHeight: 56, paddingHorizontal: 16, alignItems: 'center', borderRadius: sawaaTokens.radius.lg, borderWidth: 1 },
  inputText: { flex: 1, minWidth: 0, minHeight: 54, fontSize: 16, paddingVertical: 12 },
  eyeBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: 12, lineHeight: 18 },
});
