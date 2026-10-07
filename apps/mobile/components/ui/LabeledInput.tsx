import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { sawaaTokens } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import type { DirState } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';

interface LabeledInputProps {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  secureTextEntry?: boolean;
  showVisibilityToggle?: boolean;
  isVisible?: boolean;
  onToggleVisibility?: () => void;
  dir: DirState;
}

export function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  keyboardType,
  maxLength,
  autoCapitalize,
  secureTextEntry,
  showVisibilityToggle,
  isVisible,
  onToggleVisibility,
  dir,
}: LabeledInputProps) {
  const sawaaColors = useSawaaColors();
  const styles = React.useMemo(() => createStyles(sawaaColors), [sawaaColors]);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>{label}</Text>
      <View style={[styles.input, error ? styles.inputError : undefined, { flexDirection: dir.row }]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          accessibilityLabel={label}
          placeholderTextColor={sawaaColors.ink[500]}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry && !isVisible}
          style={[styles.inputText, { textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}
        />
        {showVisibilityToggle ? (
          <Pressable
            onPress={onToggleVisibility}
            style={styles.eyeBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            {isVisible ? (
              <Eye size={20} color={sawaaColors.ink[500]} strokeWidth={1.75} />
            ) : (
              <EyeOff size={20} color={sawaaColors.ink[500]} strokeWidth={1.75} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.error, { textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (sawaaColors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 14, lineHeight: 20, fontFamily: getFontName('ar', '700'), color: sawaaColors.ink[900] },
  input: {
    minHeight: 56,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: sawaaTokens.radius.lg,
    borderWidth: 1,
    borderColor: sawaaColors.teal[200],
    backgroundColor: sawaaColors.glass.opaqueBg,
  },
  inputError: { borderColor: sawaaColors.accent.coral },
  inputText: { flex: 1, minHeight: 54, fontSize: 16, fontFamily: getFontName('ar'), color: sawaaColors.ink[900] },
  eyeBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: 12, fontFamily: getFontName('ar'), color: sawaaColors.accent.coral },
});
