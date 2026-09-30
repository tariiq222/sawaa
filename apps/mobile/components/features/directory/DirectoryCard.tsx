import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';

import { Pill, type PillTone } from '@/components/ui/Pill';
import { Thumb } from '@/components/ui/Thumb';
import { useDir } from '@/hooks/useDir';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export interface DirectoryPill {
  label: string;
  tone?: PillTone;
}

export interface DirectoryCardProps {
  title: string;
  subtitle?: string | null;
  imageUri?: string | null;
  /** Placeholder glyph while there is no photo (person by default). */
  placeholderIcon?: LucideIcon;
  pills?: DirectoryPill[];
  /** One quiet line under the pills, e.g. "available today" or a price. */
  meta?: { icon: LucideIcon; text: string } | null;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * List card shared by the therapist and clinic directories (client and guest):
 * square 88pt photo slot on the start side, text column, chevron on the end side.
 */
export function DirectoryCard({
  title, subtitle, imageUri, placeholderIcon, pills = [], meta, onPress, accessibilityLabel, testID,
}: DirectoryCardProps) {
  const colors = useSawaaColors();
  const dir = useDir();
  const Forward = dir.isRTL ? ChevronLeft : ChevronRight;
  const MetaIcon = meta?.icon;
  return (
    <Glass
      radius={sawaaRadius.lg}
      interactive
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}
      testID={testID}
      style={styles.card}
    >
      <View style={[styles.row, { flexDirection: dir.row }]}>
        <Thumb uri={imageUri} width={88} height={88} icon={placeholderIcon} />
        <View style={styles.body}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={2} style={[styles.subtitle, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign }]}>
              {subtitle}
            </Text>
          ) : null}
          {pills.length > 0 ? (
            <View style={[styles.pills, { flexDirection: dir.row }]}>
              {pills.map((pill) => <Pill key={pill.label} label={pill.label} tone={pill.tone} />)}
            </View>
          ) : null}
          {meta && MetaIcon ? (
            <View style={[styles.meta, { flexDirection: dir.row }]}>
              <MetaIcon size={16} color={colors.ink[500]} strokeWidth={1.75} />
              <Text numberOfLines={1} style={[styles.metaText, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400') }]}>{meta.text}</Text>
            </View>
          ) : null}
        </View>
        <Forward size={18} color={colors.ink[500]} strokeWidth={1.75} />
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: sawaaSpacing.lg },
  row: { alignItems: 'center', gap: sawaaSpacing.md },
  body: { flex: 1, gap: 4 },
  title: { fontSize: sawaaType.subheading.fontSize - 2, lineHeight: 22 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  pills: { flexWrap: 'wrap', gap: 6 },
  meta: { alignItems: 'center', gap: 6 },
  metaText: { flexShrink: 1, fontSize: 13 },
});
