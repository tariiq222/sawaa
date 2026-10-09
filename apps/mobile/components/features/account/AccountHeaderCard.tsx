import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Glass } from '@/theme/components/Glass';
import { Thumb } from '@/components/ui/Thumb';
import { AppButton } from '@/components/ui/AppButton';
import { ThemedText } from '@/theme/components/ThemedText';
import { useDir } from '@/hooks/useDir';
import { useTheme } from '@/theme/useTheme';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaSpacing, sawaaType, withAlpha } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export interface AccountStat { key: string; value: string; label: string; direction?: 'ltr' | 'auto' }

interface AccountHeaderCardProps {
  name: string;
  secondary?: string | null;
  avatarUrl?: string | null;
  /** Opens personal-details editing; the whole identity row is the target. */
  onEdit?: () => void;
  stats?: AccountStat[];
  statsLoading?: boolean;
  statsError?: boolean;
  onRetryStats?: () => void;
}

/** Identity card at the top of the client and employee account tabs. */
export function AccountHeaderCard({ name, secondary, avatarUrl, onEdit, stats, statsLoading, statsError, onRetryStats }: AccountHeaderCardProps) {
  const colors = useSawaaColors();
  const dir = useDir();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;

  const identity = (
    <>
      <Thumb uri={avatarUrl} width={64} height={64} radius={sawaaRadius.pill} />
      <View style={styles.mid}>
        <Text style={[styles.name, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>{name}</Text>
        {secondary ? (
          <Text style={[styles.meta, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign, writingDirection: 'ltr' }]}>{secondary}</Text>
        ) : null}
        {onEdit ? (
          <Text style={[styles.editHint, { color: colors.teal[700], fontFamily: getFontName(dir.locale, '600'), textAlign: dir.textAlign }]}>{t('profile.personalDetails')}</Text>
        ) : null}
      </View>
      {onEdit ? <Chevron size={18} color={colors.ink[500]} strokeWidth={2} /> : null}
    </>
  );

  return (
    <Glass variant="strong" radius={sawaaRadius.lg} padding={sawaaSpacing.lg}>
      {onEdit ? (
        <Pressable onPress={onEdit} accessibilityRole="button" accessibilityLabel={`${name}، ${t('profile.personalDetails')}`}
          style={({ pressed }) => [styles.row, { flexDirection: dir.row, opacity: pressed ? 0.7 : 1 }]}>
          {identity}
        </Pressable>
      ) : <View style={[styles.row, { flexDirection: dir.row }]}>{identity}</View>}

      {stats ? (statsLoading ? (
        <View accessibilityLiveRegion="polite" style={styles.status}>
          <ActivityIndicator color={colors.teal[700]} /><ThemedText>{t('common.loading')}</ThemedText>
        </View>
      ) : (
        <View style={[styles.stats, { flexDirection: dir.row }]}>
          {stats.map((s) => (
            <View key={s.key} style={[styles.statBox, { backgroundColor: withAlpha(colors.teal[500], 0.08) }]}>
              <Text style={[styles.statN, { color: colors.teal[700], fontFamily: getFontName(dir.locale, '700'), writingDirection: s.direction === 'ltr' ? 'ltr' : dir.writingDirection }]}>{s.value}</Text>
              <Text style={[styles.statL, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400') }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      )) : null}
      {statsError ? (
        <View style={styles.status}>
          <ThemedText accessibilityRole="alert" color={theme.colors.error}>{t('profile.summaryLoadError')}</ThemedText>
          {onRetryStats ? <AppButton label={t('common.retry')} variant="ghost" size="sm" onPress={onRetryStats} /> : null}
        </View>
      ) : null}
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', gap: 14, minHeight: 64 },
  mid: { flex: 1, minWidth: 0, flexShrink: 1, gap: 2 },
  name: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  meta: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  editHint: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight },
  status: { marginTop: sawaaSpacing.lg, gap: sawaaSpacing.sm, alignItems: 'center' },
  stats: { marginTop: sawaaSpacing.lg, gap: sawaaSpacing.sm },
  statBox: { flex: 1, minWidth: 0, flexShrink: 1, paddingVertical: 10, borderRadius: sawaaRadius.md, alignItems: 'center' },
  statN: { textAlign: 'center', fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  statL: { textAlign: 'center', fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight, marginTop: 2 },
});
