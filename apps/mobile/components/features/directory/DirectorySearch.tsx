import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';

import { useDir } from '@/hooks/useDir';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface DirectorySearchProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  testID?: string;
}

/** Capsule search field used by the therapist and clinic directories. */
export function DirectorySearch({ value, onChangeText, placeholder, accessibilityLabel, testID }: DirectorySearchProps) {
  const colors = useSawaaColors();
  const dir = useDir();
  return (
    <Glass radius={sawaaRadius.pill} style={styles.card}>
      <View style={[styles.row, { flexDirection: dir.row }]}>
        <Search size={20} color={colors.ink[500]} strokeWidth={1.75} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.ink[500]}
          accessibilityLabel={accessibilityLabel}
          testID={testID}
          style={[styles.input, {
            color: colors.ink[900],
            fontFamily: getFontName(dir.locale, '400'),
            textAlign: dir.textAlign,
            writingDirection: dir.writingDirection,
          }]}
        />
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 52, justifyContent: 'center' },
  row: { alignItems: 'center', gap: 10, paddingHorizontal: 18 },
  input: { flex: 1, minHeight: 52, fontSize: 15 },
});
