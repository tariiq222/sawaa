import React, { useCallback, useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Users } from 'lucide-react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { useGroupSessions } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import type { GroupSession } from '@/services/client/group-sessions';
import { AquaBackground, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { ThemedText } from '@/theme/components/ThemedText';
import { concentricRadius, withAlpha } from '@/theme/sawaa/tokens';

const CARD_RADIUS = sawaaRadius.xl;
const CARD_PADDING = 16;

function formatDateTime(value: string, isRTL: boolean) {
  return new Intl.DateTimeFormat(isRTL ? 'ar-SA' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(isRTL ? { calendar: 'gregory' } : {}),
  }).format(new Date(value));
}

function formatPrice(price: number, isRTL: boolean, sar: string) {
  return `${new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US').format(price / 100)} ${sar}`;
}

export default function GroupsScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const groupsQuery = useGroupSessions();
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const backSymbol = (dir.isRTL ? 'chevron.right' : 'chevron.left') as React.ComponentProps<typeof AppIcon>['sf'];

  const renderItem = useCallback(({ item }: { item: GroupSession }) => {
    const isClosed = item.isFull;
    const stateLabel = isClosed
      ? t('groups.full')
      : t('groups.spotsLeft', { count: item.spotsLeft });

    return (
      <Glass
        variant="strong"
        radius={CARD_RADIUS}
        onPress={() => router.push(`/(client)/groups/${item.id}`)}
        accessibilityLabel={item.title}
        style={styles.card}
      >
        <View style={styles.cardBody}>
          <View style={[styles.cardHeader, { flexDirection: dir.row }]}> 
            <View style={styles.iconWrap}>
              <AppIcon sf="person.3.fill" fallback={Users} size={22} color={colors.teal[700]} strokeWidth={1.6} />
            </View>
            <View style={styles.titleBlock}>
              <ThemedText variant="subheading" style={{ textAlign: dir.textAlign }} numberOfLines={2}>
                {item.title}
              </ThemedText>
              <MetaLine icon="calendar" text={formatDateTime(item.scheduledAt ?? '', dir.isRTL)} dir={dir} />
            </View>
          </View>

          <View style={[styles.infoRow, { flexDirection: dir.row }]}> 
            <MetaLine icon="users" text={t('groups.enrolled', { count: item.enrolledCount, max: item.maxCapacity })} dir={dir} />
            <MetaLine icon="price" text={formatPrice(Number(item.price), dir.isRTL, t('home.sar'))} dir={dir} />
          </View>

          <View style={[styles.footerRow, { flexDirection: dir.row }]}>
            <StateBadge label={stateLabel} tone={isClosed ? 'muted' : 'open'} />
            <ThemedText variant="label" color={isClosed ? colors.ink[400] : colors.teal[700]}>
              {isClosed ? t('groups.contactUs') : t('groups.join')}
            </ThemedText>
          </View>
        </View>
      </Glass>
    );
  }, [colors, dir, router, styles, t]);

  const emptyState = useMemo(() => {
    if (groupsQuery.isLoading) return <ActivityIndicator color={colors.teal[600]} />;
    if (groupsQuery.isError) return <ThemedText variant="bodySm" align="center">{t('groups.bookError')}</ThemedText>;
    return <ThemedText variant="bodySm" color={colors.ink[500]} align="center">{t('groups.empty')}</ThemedText>;
  }, [colors, groupsQuery.isError, groupsQuery.isLoading, t]);

  return (
    <AquaBackground>
      <FlatList
        data={groups}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={(
          <View style={[styles.headerRow, { flexDirection: dir.row }]}> 
            <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel={t('a11y.buttonBack')}>
              <AppIcon sf={backSymbol} fallback={BackIcon} size={24} color={colors.ink[900]} strokeWidth={1.5} />
            </Pressable>
            <ThemedText variant="subheading">{t('groups.title')}</ThemedText>
            <View style={styles.backBtn} />
          </View>
        )}
        ListEmptyComponent={<View style={styles.emptyState}>{emptyState}</View>}
      />
    </AquaBackground>
  );
}

function MetaLine({ icon, text, dir }: { icon: 'calendar' | 'price' | 'users'; text: string; dir: ReturnType<typeof useDir> }) {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const config = {
    calendar: { sf: 'calendar' as const, fallback: CalendarDays },
    price: { sf: 'banknote.fill' as const, fallback: CircleDollarSign },
    users: { sf: 'person.2.fill' as const, fallback: Users },
  }[icon];
  return (
    <View style={[styles.metaLine, { flexDirection: dir.row }]}> 
      <AppIcon sf={config.sf} fallback={config.fallback} size={14} color={colors.ink[500]} strokeWidth={1.6} />
      <ThemedText variant="caption" color={colors.ink[500]} style={{ textAlign: dir.textAlign }} numberOfLines={1}>
        {text}
      </ThemedText>
    </View>
  );
}

function StateBadge({ label, tone }: { label: string; tone: 'muted' | 'open' }) {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const color = tone === 'muted' ? colors.ink[500] : colors.teal[700];
  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: withAlpha(color, 0.12) }]}> 
      <ThemedText variant="label" color={color}>{label}</ThemedText>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  list: { flexGrow: 1, paddingHorizontal: 24, gap: 12 },
  headerRow: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { marginBottom: 12 },
  cardBody: { padding: CARD_PADDING, gap: 14 },
  cardHeader: { alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: concentricRadius(CARD_RADIUS, CARD_PADDING),
    backgroundColor: colors.glass.bgStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { flex: 1, gap: 5 },
  infoRow: { alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  metaLine: { alignItems: 'center', gap: 6, flexShrink: 1 },
  footerRow: { alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: sawaaRadius.pill, borderWidth: 0.5 },
  emptyState: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center' },
});
