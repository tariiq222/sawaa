import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Star, type LucideIcon } from 'lucide-react-native';

import { Pill, type PillTone } from '@/components/ui/Pill';
import { Thumb } from '@/components/ui/Thumb';
import { useDir } from '@/hooks/useDir';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface ProfileHeroProps {
  name: string;
  /** Secondary lines under the name (specialty, clinic, short description). */
  lines?: string[];
  imageUri?: string | null;
  placeholderIcon?: LucideIcon;
  pills?: Array<{ label: string; tone?: PillTone }>;
  /** Real rating only; omitted entirely when there are no ratings. */
  rating?: { value: string; caption: string } | null;
}

/** Profile header card: square 120pt photo beside name, details and tags. */
export function ProfileHero({ name, lines = [], imageUri, placeholderIcon, pills = [], rating }: ProfileHeroProps) {
  const colors = useSawaaColors();
  const dir = useDir();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width <= 360 || fontScale >= 1.5;
  const portrait = stacked ? 88 : 120;
  return (
    <Glass radius={sawaaRadius.xl} style={styles.card}>
      <View style={[styles.row, { flexDirection: stacked ? 'column' : dir.row }]}>
        <Thumb uri={imageUri} width={portrait} height={portrait} icon={placeholderIcon} accessibilityLabel={name} />
        <View style={styles.body}>
          <Text accessibilityRole="header" style={[styles.name, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign }]}>
            {name}
          </Text>
          {lines.map((line) => (
            <Text key={line} style={[styles.line, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign }]}>{line}</Text>
          ))}
          {rating ? (
            <View style={[styles.rating, { flexDirection: dir.row }]}>
              <Star size={14} color={colors.accent.amber} fill={colors.accent.amber} strokeWidth={2} />
              <Text style={[styles.ratingText, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700') }]}>{rating.value}</Text>
              <Text style={[styles.ratingText, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400') }]}>{rating.caption}</Text>
            </View>
          ) : null}
          {pills.length > 0 ? (
            <View style={[styles.pills, { flexDirection: dir.row }]}>
              {pills.map((pill) => <Pill key={pill.label} label={pill.label} tone={pill.tone} />)}
            </View>
          ) : null}
        </View>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: sawaaSpacing.lg },
  row: { alignItems: 'flex-start', gap: sawaaSpacing.lg },
  body: { flex: 1, minWidth: 0, alignSelf: 'stretch', gap: 6, paddingTop: 2 },
  name: { fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  line: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  rating: { flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  ratingText: { flexShrink: 1, maxWidth: '100%', fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight },
  pills: { flexWrap: 'wrap', gap: 6, marginTop: 4 },
});
