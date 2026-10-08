import { useCallback, useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { View, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/theme/components/Glass';
import {
  AquaBackground,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
} from '@/theme/sawaa';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmployeeAppointmentCard } from '@/components/features/employee/EmployeeAppointmentCard';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { useAppSelector } from '@/hooks/use-redux';
import { useEmployeeTodayBookings } from '@/hooks/queries';
import type { Booking } from '@/types/models';

export default function TodayScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const user = useAppSelector((s) => s.auth.user);
  const router = useRouter();
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const todayQuery = useEmployeeTodayBookings();
  const refetchToday = todayQuery.refetch;
  const bookings = todayQuery.data?.items ?? [];
  const loading = todayQuery.isLoading;
  const loadFailed = todayQuery.isError;
  const onRefresh = useCallback(() => { void refetchToday(); }, [refetchToday]);

  const remaining = bookings.filter((b) => b.status === 'confirmed').length;
  const completed = bookings.filter((b) => b.status === 'completed').length;

  const stats: { label: string; value: number }[] = [
    { label: t('doctor.totalToday'), value: bookings.length },
    { label: t('doctor.remaining'), value: remaining },
    { label: t('doctor.completedToday'), value: completed },
  ];

  const greeting = user?.firstName
    ? t('doctor.greetingName', { name: user.firstName })
    : t('doctor.greeting');
  const today = new Date().toLocaleDateString(dir.isRTL ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const textStyle = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;

  const renderItem = ({ item, index }: { item: Booking; index: number }) => (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.delay(240 + Math.min(index, 6) * 70).duration(600).easing(Easing.out(Easing.cubic))}
    >
      <EmployeeAppointmentCard
        booking={item}
        onPress={() => router.push(`/(employee)/appointment/${item.id}`)}
      />
    </Animated.View>
  );

  const ListHeader = (
    <View style={styles.headerWrap}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}
        style={styles.greetingBlock}
      >
        <Text style={[styles.dateLabel, textStyle, { fontFamily: f600 }]}>{today}</Text>
        <Text accessibilityRole="header" style={[styles.greeting, textStyle, { fontFamily: f700 }]}>
          {greeting}
        </Text>
      </Animated.View>

      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.delay(120).duration(600).easing(Easing.out(Easing.cubic))}
        style={[styles.statsRow, { flexDirection: dir.row }]}
      >
        {stats.map((s) => (
          <Glass key={s.label} variant="base" radius={sawaaRadius.lg} padding={sawaaSpacing.md} style={styles.statCard}>
            {loading ? (
              <Skeleton width={36} height={24} radius={sawaaRadius.xs} style={styles.statSkeleton} />
            ) : (
              <Text style={[styles.statValue, { fontFamily: f700 }]}>
                {loadFailed ? '—' : dir.isRTL ? s.value.toLocaleString('ar-SA') : s.value}
              </Text>
            )}
            <Text style={[styles.statLabel, { fontFamily: f600, writingDirection: dir.writingDirection }]}>
              {s.label}
            </Text>
          </Glass>
        ))}
      </Animated.View>

      <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(200).duration(600).easing(Easing.out(Easing.cubic))}>
        <SectionHeader title={t('doctor.todaySchedule')} />
      </Animated.View>
    </View>
  );

  const ListEmpty = loading ? (
    <View style={styles.skeletonList}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={76} radius={sawaaRadius.lg} />
      ))}
    </View>
  ) : loadFailed ? (
    <EmptyState
      icon="alert-circle-outline"
      title={t('common.error')}
      description={t('doctor.scheduleLoadFailed')}
      actionLabel={t('common.retry')}
      onAction={onRefresh}
      tone="danger"
    />
  ) : (
    <EmptyState
      icon="calendar-outline"
      title={t('doctor.noAppointmentsToday')}
      description={t('doctor.noAppointmentsHint')}
    />
  );

  return (
    <AquaBackground>
      <FlatList
        data={loading ? [] : bookings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={todayQuery.isRefetching} onRefresh={onRefresh} tintColor={colors.teal[600]} />
        }
        contentContainerStyle={[styles.list, { paddingTop: insets.top + sawaaSpacing.sm }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: sawaaSpacing.md }} />}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
      />
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  list: { paddingHorizontal: sawaaSpacing.lg, paddingBottom: 140 },
  headerWrap: { gap: sawaaSpacing.lg, marginBottom: sawaaSpacing.md },
  greetingBlock: { marginTop: sawaaSpacing.xs },
  dateLabel: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[700],
  },
  greeting: {
    fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight,
    color: colors.ink[900],
    marginTop: sawaaSpacing.xs,
  },
  statsRow: { gap: sawaaSpacing.sm },
  statCard: { flex: 1, minWidth: 0 },
  statValue: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: colors.teal[700],
    textAlign: 'center',
  },
  statSkeleton: { alignSelf: 'center', marginVertical: sawaaSpacing.xs },
  statLabel: {
    fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight,
    color: colors.ink[700],
    textAlign: 'center',
    marginTop: sawaaSpacing.xs,
  },
  skeletonList: { gap: sawaaSpacing.md },
});
