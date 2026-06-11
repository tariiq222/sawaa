import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Users } from 'lucide-react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { useGroupSessions } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import type { GroupSession } from '@/services/client/group-sessions';
import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { ThemedText } from '@/theme/components/ThemedText';
import { concentricRadius } from '@/theme/sawaa/tokens';

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const groupsQuery = useGroupSessions();
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const backSymbol = (dir.isRTL ? 'chevron.right' : 'chevron.left') as React.ComponentProps<typeof AppIcon>['sf'];

  const renderItem = useCallback(({ item }: { item: GroupSession }) => {
    const isWaitlist = item.isFull && item.waitlistEnabled;
    const isClosed = item.isFull && !item.waitlistEnabled;
    const stateLabel = isWaitlist
      ? t('groups.waitlist')
      : isClosed
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
              <AppIcon sf="person.3.fill" fallback={Users} size={22} color={sawaaColors.teal[700]} strokeWidth={1.6} />
            </View>
            <View style={styles.titleBlock}>
              <ThemedText variant="subheading" style={{ textAlign: dir.textAlign }} numberOfLines={2}>
                {item.title}
              </ThemedText>
              <MetaLine icon="calendar" text={formatDateTime(item.scheduledAt, dir.isRTL)} dir={dir} />
            </View>
          </View>

          <View style={[styles.infoRow, { flexDirection: dir.row }]}> 
            <MetaLine icon="users" text={t('groups.enrolled', { count: item.enrolledCount, max: item.maxCapacity })} dir={dir} />
            <MetaLine icon="price" text={formatPrice(item.price, dir.isRTL, t('home.sar'))} dir={dir} />
          </View>

          <View style={[styles.footerRow, { flexDirection: dir.row }]}> 
            <StateBadge label={stateLabel} tone={isClosed ? 'muted' : isWaitlist ? 'waitlist' : 'open'} />
            <ThemedText variant="label" color={isClosed ? sawaaColors.ink[400] : sawaaColors.teal[700]}>
              {isWaitlist ? t('groups.joinWaitlist') : isClosed ? t('groups.full') : t('groups.join')}
            </ThemedText>
          </View>
        </View>
      </Glass>
    );
  }, [dir, router, t]);

  const emptyState = useMemo(() => {
    if (groupsQuery.isLoading) return <ActivityIndicator color={sawaaColors.teal[600]} />;
    if (groupsQuery.isError) return <ThemedText variant="bodySm" align="center">{t('groups.bookError')}</ThemedText>;
    return <ThemedText variant="bodySm" color={sawaaColors.ink[500]} align="center">{t('groups.empty')}</ThemedText>;
  }, [groupsQuery.isError, groupsQuery.isLoading, t]);

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
            <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
              <AppIcon sf={backSymbol} fallback={BackIcon} size={24} color={sawaaColors.ink[900]} strokeWidth={1.5} />
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
  const config = {
    calendar: { sf: 'calendar' as const, fallback: CalendarDays },
    price: { sf: 'banknote.fill' as const, fallback: CircleDollarSign },
    users: { sf: 'person.2.fill' as const, fallback: Users },
  }[icon];
  return (
    <View style={[styles.metaLine, { flexDirection: dir.row }]}> 
      <AppIcon sf={config.sf} fallback={config.fallback} size={14} color={sawaaColors.ink[500]} strokeWidth={1.6} />
      <ThemedText variant="caption" color={sawaaColors.ink[500]} style={{ textAlign: dir.textAlign }} numberOfLines={1}>
        {text}
      </ThemedText>
    </View>
  );
}

function StateBadge({ label, tone }: { label: string; tone: 'muted' | 'open' | 'waitlist' }) {
  const color = tone === 'muted' ? sawaaColors.ink[500] : tone === 'waitlist' ? sawaaColors.accent.amber : sawaaColors.teal[700];
  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}1e` }]}> 
      <ThemedText variant="label" color={color}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: sawaaColors.glass.bgStrong,
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
