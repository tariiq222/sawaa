import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';

import { Glass } from '@/theme';
import { sawaaTokens } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import type { DirState } from '@/hooks/useDir';

interface LabeledInputProps {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  placeholder?: string;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
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
      <Text style={[styles.label, { textAlign: dir.textAlign }]}>{label}</Text>
      <Glass variant="clear" radius={sawaaTokens.radius.md} style={styles.input}>
        <View style={[styles.inputRow, { flexDirection: dir.row }]}>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={sawaaColors.ink[500]}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            secureTextEntry={secureTextEntry && !isVisible}
            style={[styles.inputText, { textAlign: dir.textAlign }]}
          />
          {showVisibilityToggle ? (
            <Pressable onPress={onToggleVisibility} style={styles.eyeBtn} hitSlop={8}>
              {isVisible ? (
                <Eye size={20} color={sawaaColors.ink[500]} strokeWidth={1.75} />
              ) : (
                <EyeOff size={20} color={sawaaColors.ink[500]} strokeWidth={1.75} />
              )}
            </Pressable>
          ) : null}
        </View>
      </Glass>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (sawaaColors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: '700', color: sawaaColors.teal[700] },
  input: { padding: 14, flexDirection: 'row', alignItems: 'center' },
  inputRow: { alignItems: 'center', alignSelf: 'stretch', width: '100%' },
  inputText: { flex: 1, fontSize: 14, color: sawaaColors.ink[900] },
  eyeBtn: { padding: 4 },
  error: { fontSize: 12, color: sawaaColors.accent.coral },
});
