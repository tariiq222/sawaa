import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { sawaaRadius, sawaaSpacing, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export type StateTone = 'error' | 'offline' | 'neutral';

export interface StateAction {
  label: string;
  onPress: () => void;
}

interface StateMessageProps {
  icon: LucideIcon;
  tone: StateTone;
  title: string;
  description?: string;
  /** Filled capsule (retry). Rendered only when it has a label and a handler. */
  primaryAction?: StateAction;
  /** Outlined capsule (clear search). */
  secondaryAction?: StateAction;
}

const CIRCLE = 96;
const GLYPH = 44;
const DESCRIPTION_MAX_WIDTH = 290;
const SECONDARY_HEIGHT = 56;

/**
 * Shared layout for the full-screen state boards (error, offline, no results):
 * tinted 96 circle with a Lucide glyph, title, muted description, one action.
 * Presentational only; callers pass already-localized strings.
 */
export function StateMessage({ icon: Icon, tone, title, description, primaryAction, secondaryAction }: StateMessageProps) {
  const colors = useSawaaColors();
  const { locale, writingDirection } = useDir();

  const palette = {
    error: { bg: withAlpha(colors.accent.coral, 0.18), glyph: colors.accent.coral },
    offline: { bg: withAlpha(colors.accent.amber, 0.22), glyph: colors.ink[900] },
    neutral: { bg: colors.teal[50], glyph: colors.teal[700] },
  }[tone];

  return (
    <View style={styles.root}>
      <View style={styles.message}>
        <View style={[styles.circle, { backgroundColor: palette.bg }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon size={GLYPH} color={palette.glyph} strokeWidth={2} />
        </View>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: colors.ink[900], fontFamily: getFontName(locale, '700'), writingDirection }]}
        >
          {title}
        </Text>
        {description ? (
          <Text style={[styles.description, { color: colors.ink[700], fontFamily: getFontName(locale, '400'), writingDirection }]}>
            {description}
          </Text>
        ) : null}
      </View>
      {primaryAction?.label && primaryAction.onPress ? (
        <PrimaryButton label={primaryAction.label} onPress={primaryAction.onPress} fontFamily={getFontName(locale, '700')} style={styles.action} />
      ) : null}
      {secondaryAction?.label && secondaryAction.onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={secondaryAction.label}
          onPress={secondaryAction.onPress}
          style={[styles.secondary, styles.action, { borderColor: colors.teal[700] }]}
        >
          <Text style={[styles.secondaryLabel, { color: colors.teal[700], fontFamily: getFontName(locale, '700') }]}>
            {secondaryAction.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingVertical: sawaaSpacing['3xl'], paddingHorizontal: sawaaSpacing.lg },
  message: { alignItems: 'center', gap: 12 },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 8, fontSize: 22, lineHeight: 30, fontWeight: '700', textAlign: 'center' },
  description: { fontSize: 15, lineHeight: 24, textAlign: 'center', maxWidth: DESCRIPTION_MAX_WIDTH },
  action: { alignSelf: 'stretch', marginTop: 20 },
  secondary: {
    minHeight: SECONDARY_HEIGHT,
    borderRadius: sawaaRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: { fontSize: 17, fontWeight: '700' },
});
