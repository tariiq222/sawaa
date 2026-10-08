import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { useDir } from '@/hooks/useDir';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface ServiceRowProps {
  title: string;
  subtitle?: string | null;
  onPress: () => void;
  /** `radio` rows pick a booking option and show a check when chosen; `link` rows open a screen. */
  mode?: 'link' | 'radio';
  selected?: boolean;
  testID?: string;
}

/** One service / booking option. No price: it depends on the practitioner and is shown at the next step. */
export function ServiceRow({ title, subtitle, onPress, mode = 'link', selected = false, testID }: ServiceRowProps) {
  const colors = useSawaaColors();
  const dir = useDir();
  const Forward = dir.isRTL ? ChevronLeft : ChevronRight;
  return (
    <Glass
      radius={sawaaRadius.lg}
      interactive
      onPress={onPress}
      accessibilityRole={mode === 'radio' ? 'radio' : 'button'}
      accessibilityState={mode === 'radio' ? { selected } : undefined}
      accessibilityLabel={title}
      testID={testID}
      style={[styles.card, selected && { borderWidth: 2, borderColor: colors.teal[600] }]}
    >
      <View style={[styles.row, { flexDirection: dir.row }]}>
        <View style={styles.body}>
          <Text style={[styles.title, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign }]}>{subtitle}</Text>
          ) : null}
        </View>
        {mode === 'radio' ? (
          selected ? <Check size={20} color={colors.teal[700]} strokeWidth={2.25} /> : <View style={styles.spacer} />
        ) : (
          <Forward size={18} color={colors.ink[500]} strokeWidth={1.75} />
        )}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: sawaaSpacing.lg, minHeight: 64, justifyContent: 'center' },
  row: { alignItems: 'center', gap: sawaaSpacing.md },
  body: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  subtitle: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  spacer: { width: 20 },
});
