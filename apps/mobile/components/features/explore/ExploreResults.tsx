import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronLeft, ChevronRight, ClipboardList, Ticket, User, Users, type LucideIcon } from 'lucide-react-native';

import { AppButton } from '@/components/ui/AppButton';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useDir } from '@/hooks/useDir';
import type { ExploreFilter, ExploreKind, ExploreResult } from '@/lib/explore-directory';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

export const EXPLORE_KINDS: Array<{ id: ExploreKind; labelKey: string; icon: LucideIcon }> = [
  { id: 'clinic', labelKey: 'clinics.title', icon: Building2 },
  { id: 'service', labelKey: 'guest.services', icon: ClipboardList },
  { id: 'therapist', labelKey: 'guest.therapists', icon: User },
  { id: 'package', labelKey: 'guest.packages', icon: Ticket },
  { id: 'program', labelKey: 'guest.programs', icon: Users },
];

/** Most rows one kind shows on the unfiltered, unsearched overview. */
export const OVERVIEW_LIMIT = 4;

interface ExploreResultsProps {
  results: ExploreResult[];
  filter: ExploreFilter;
  searching: boolean;
  onOpen: (result: ExploreResult) => void;
  onSelectKind: (kind: ExploreKind) => void;
}

/** Results grouped by kind; the overview caps each group and links to the full kind. */
export function ExploreResults({ results, filter, searching, onOpen, onSelectKind }: ExploreResultsProps) {
  const { t } = useTranslation();
  const capped = filter === 'all' && !searching;
  const groups = useMemo(() => EXPLORE_KINDS
    .map((kind) => ({ ...kind, items: results.filter((result) => result.kind === kind.id) }))
    .filter((group) => group.items.length > 0), [results]);

  return (
    <View style={styles.groups}>
      {groups.map((group) => {
        const shown = capped ? group.items.slice(0, OVERVIEW_LIMIT) : group.items;
        return (
          <View key={group.id} style={styles.group}>
            {filter === 'all' ? <SectionHeader title={t(group.labelKey)} /> : null}
            {shown.map((result) => (
              <ResultRow key={`${result.kind}-${result.id}`} result={result} icon={group.icon} onPress={() => onOpen(result)} />
            ))}
            {capped && group.items.length > shown.length ? (
              <AppButton
                variant="ghost"
                size="sm"
                label={t('explore.viewAll', { count: group.items.length })}
                onPress={() => onSelectKind(group.id)}
                testID={`explore-view-all-${group.id}`}
                style={{ alignSelf: 'center' }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function ResultRow({ result, icon: Icon, onPress }: { result: ExploreResult; icon: LucideIcon; onPress: () => void }) {
  const colors = useSawaaColors();
  const dir = useDir();
  const Forward = dir.isRTL ? ChevronLeft : ChevronRight;
  const showDetail = Boolean(result.detail) && result.detail !== result.title;
  return (
    <Glass
      variant="strong"
      radius={sawaaRadius.lg}
      interactive
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={showDetail ? `${result.title}, ${result.detail}` : result.title}
      testID={`explore-result-${result.kind}-${result.id}`}
      style={styles.result}
    >
      <View style={[styles.resultRow, { flexDirection: dir.row }]}>
        <Icon size={22} color={colors.teal[700]} strokeWidth={1.75} />
        <View style={styles.resultText}>
          <Text numberOfLines={2} style={[styles.title, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>{result.title}</Text>
          {showDetail ? (
            <Text numberOfLines={2} style={[styles.detail, { color: colors.ink[500], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>{result.detail}</Text>
          ) : null}
        </View>
        <Forward size={18} color={colors.ink[500]} strokeWidth={2} />
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  groups: { gap: sawaaSpacing.xl },
  group: { gap: 10 },
  result: { minHeight: 68, justifyContent: 'center', padding: 15 },
  resultRow: { alignItems: 'center', gap: 12 },
  resultText: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  detail: { fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight },
});
