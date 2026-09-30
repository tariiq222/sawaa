import React, { useMemo, useState, useCallback } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { AquaBackground, sawaaRadius, sawaaSpacing } from '@/theme/sawaa';
import { AppointmentRowCard } from '@/components/features/appointments/AppointmentRowCard';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useClientBookings, clientBookingsKeys } from '@/hooks/queries';
import { bookingTabForStatus, type ClientBookingRow } from '@/services/client/bookings';
import { useReduceMotion } from '@/hooks/useA11y';
import { createAppointmentsStyles } from '@/components/features/appointments/appointments.styles';

type TabKey = 'upcoming' | 'past' | 'cancelled';

const TABS: { key: TabKey; ar: string; en: string }[] = [
  { key: 'upcoming', ar: 'قادمة', en: 'Upcoming' },
  { key: 'past', ar: 'منتهية', en: 'Completed' },
  { key: 'cancelled', ar: 'الإلغاءات', en: 'Cancellations' },
];

export function getAppointmentTabLabel(tab: TabKey, isRTL: boolean): string {
  const option = TABS.find((candidate) => candidate.key === tab);
  return option ? (isRTL ? option.ar : option.en) : '';
}

export default function AppointmentsScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createAppointmentsStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const router = useRouter();
  const f700 = getFontName(dir.locale, '700');
  const [tab, setTab] = useState<TabKey>('upcoming');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { data, isLoading, isError, isRefetching, refetch } = useClientBookings({ tab, page, limit: 50 });
  const bookings = useMemo(() => data?.items ?? [], [data?.items]);

  const items = useMemo(
    () => bookings.filter((b) => bookingTabForStatus(b.status) === tab),
    [bookings, tab],
  );

  const onRefresh = () => {
    queryClient.invalidateQueries({ queryKey: clientBookingsKeys.all });
    refetch();
  };

  const renderItem = useCallback(({ item: b, index: i }: { item: ClientBookingRow; index: number }) => (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(120 + Math.min(i, 6) * 60).duration(500).easing(Easing.out(Easing.cubic))}
      style={styles.cardWrap}
    >
      <AppointmentRowCard
        booking={b}
        showJoin={tab === 'upcoming'}
        onPress={() => router.push(`/(client)/appointment/${b.id}`)}
      />
    </Animated.View>
  // `colors` is listed so rows re-render when the palette changes (guarded by dark-screen-colors.test).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [colors, styles, reduceMotion, router, tab]);

  const emptyTitle = tab === 'upcoming'
    ? t('appointments.noUpcoming')
    : tab === 'past' ? t('appointments.noPast') : t('appointments.noCancelled');

  const ListHeader = useMemo(() => (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
        {t('appointments.title')}
      </Text>
      <View style={[styles.tabs, { flexDirection: dir.row }]}>
        {TABS.map((tabItem) => (
          <Chip
            key={tabItem.key}
            label={getAppointmentTabLabel(tabItem.key, dir.isRTL)}
            selected={tab === tabItem.key}
            onPress={() => { setTab(tabItem.key); setPage(1); }}
          />
        ))}
      </View>
    </View>
  ), [styles, dir, f700, t, tab]);

  const ListEmpty = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={`appt-skeleton-${i}`} height={96} radius={sawaaRadius.lg} />
          ))}
        </View>
      );
    }
    if (isError) {
      return (
        <EmptyState
          icon="cloud-offline-outline"
          tone="danger"
          title={t('appointments.loadFailed')}
          description={t('appointments.loadFailedHint')}
          actionLabel={t('common.retry')}
          onAction={() => refetch()}
        />
      );
    }
    return (
      <EmptyState
        icon="calendar-outline"
        title={emptyTitle}
        description={t('appointments.noAppointmentsHint')}
      />
    );
  }, [styles, emptyTitle, isError, isLoading, refetch, t]);

  return (
    <AquaBackground>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.xl, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={
          <View style={[styles.pageControls, { flexDirection: dir.row }]}>
            {page > 1 && (
              <Pressable accessibilityRole="button" onPress={() => setPage((value) => value - 1)} style={styles.pageButton}>
                <Text style={styles.pageButtonText}>{t('common.back')}</Text>
              </Pressable>
            )}
            {data?.meta.hasNextPage && (
              <Pressable accessibilityRole="button" onPress={() => setPage((value) => value + 1)} style={styles.pageButton}>
                <Text style={styles.pageButtonText}>{t('common.next')}</Text>
              </Pressable>
            )}
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={onRefresh}
            tintColor={colors.teal[600]}
            accessibilityLabel={t('a11y.refreshAppointments')}
          />
        }
        scrollEventThrottle={16}
      />
    </AquaBackground>
  );
}
