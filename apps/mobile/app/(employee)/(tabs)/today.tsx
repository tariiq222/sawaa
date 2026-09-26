import { useCallback, useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { View, FlatList, Pressable, RefreshControl, StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Building2, Video, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/theme/components/Glass';
import {
  AquaBackground,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
  withAlpha,
} from '@/theme/sawaa';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { useAppSelector } from '@/hooks/use-redux';
import { useEmployeeTodayBookings } from '@/hooks/queries';
import { getStatusLabel } from '@/lib/status-helpers';
import type { Booking } from '@/types/models';

const TYPE_ICON = {
  individual: Building2,
  in_person: Building2,
  online: Video,
  walk_in: Building2,
  group: Building2,
};

const getTypeColors = (colors: ReturnType<typeof useSawaaColors>) => ({
  individual: colors.accent.sky,
  in_person: colors.accent.sky,
  online: colors.accent.violet,
  walk_in: colors.teal[500],
  group: colors.accent.violet,
});

export default function TodayScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const TYPE_COLOR = getTypeColors(colors);
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

  const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
  const completed = bookings.filter((b) => b.status === 'completed').length;
  const remaining = confirmed;

  const stats: { label: string; value: number; color: string }[] = [
    { label: t('doctor.totalToday'), value: bookings.length, color: colors.accent.sky },
    { label: t('doctor.remaining'), value: remaining, color: colors.accent.amber },
    { label: t('doctor.completedToday'), value: completed, color: colors.teal[500] },
  ];

  const greeting = user?.firstName
    ? `${t('doctor.greeting')} ${user.firstName}`
    : t('doctor.greeting');
  const today = new Date().toLocaleDateString(dir.isRTL ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const renderItem = ({ item, index }: { item: Booking; index: number }) => {
    const Icon = TYPE_ICON[item.type];
    const color = TYPE_COLOR[item.type];
    const clientName = item.client
      ? `${item.client.firstName} ${item.client.lastName}`
      : t('doctor.clientRecord');
    return (
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.delay(240 + index * 70).duration(600).easing(Easing.out(Easing.cubic))}
      >
        <Glass variant="base" radius={sawaaRadius.xl} padding={sawaaSpacing.lg}>
          <Pressable
            onPress={() => router.push(`/(employee)/appointment/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`${clientName} ${item.startTime}`}
            style={({ pressed }) => [styles.itemRow, { flexDirection: dir.row, opacity: pressed ? 0.7 : 1 }]}
          >
            <View style={[styles.iconCircle, { backgroundColor: withAlpha(color, 0.12) }]}>
              <Icon size={16} strokeWidth={1.5} color={color} />
            </View>
            <View style={styles.itemMid}>
              <Text
                numberOfLines={1}
                style={[styles.clientName, { fontFamily: f600, fontWeight: '600', textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}
              >
                {clientName}
              </Text>
              <View style={[styles.timeRow, { flexDirection: dir.row }]}>
                <Clock size={12} strokeWidth={1.5} color={colors.ink[400]} />
                <Text style={[styles.timeText, { writingDirection: dir.writingDirection }]}>
                  {item.startTime} — {item.endTime}
                </Text>
              </View>
            </View>
            <StatusPill status={item.status} label={t(getStatusLabel(item.status))} />
          </Pressable>
        </Glass>
      </Animated.View>
    );
  };

  const ListHeader = (
    <View style={styles.headerWrap}>
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}
        style={styles.greetingBlock}
      >
        <Text style={[styles.dateLabel, { fontFamily: f600, fontWeight: '600', textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
          {today}
        </Text>
        <Text style={[styles.greeting, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
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
              <Text style={[styles.statValue, { fontFamily: f700, color: s.color }]}>
                {loadFailed ? '—' : dir.isRTL ? s.value.toLocaleString('ar-SA') : s.value}
              </Text>
            )}
            <Text style={[styles.statLabel, { fontFamily: f600, fontWeight: '600', writingDirection: dir.writingDirection }]}>
              {s.label}
            </Text>
          </Glass>
        ))}
      </Animated.View>

      <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(200).duration(600).easing(Easing.out(Easing.cubic))}>
        <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
          {t('doctor.todaySchedule')}
        </Text>
      </Animated.View>
    </View>
  );

  const ListEmpty = loading ? (
    <View style={styles.skeletonList}>
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={76} radius={sawaaRadius.xl} />
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
  headerWrap: { gap: sawaaSpacing.lg, marginBottom: sawaaSpacing.lg },
  greetingBlock: { paddingHorizontal: sawaaSpacing.xs, marginTop: sawaaSpacing.xs },
  dateLabel: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: colors.teal[700],
    opacity: 0.75,
  },
  greeting: {
    fontSize: sawaaType.display.fontSize,
    lineHeight: sawaaType.display.lineHeight,
    color: colors.ink[900],
    marginTop: sawaaSpacing.xs,
  },
  statsRow: { gap: sawaaSpacing.sm },
  statCard: { flex: 1 },
  statValue: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    textAlign: 'center',
  },
  statSkeleton: { alignSelf: 'center', marginVertical: sawaaSpacing.xs },
  statLabel: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[500],
    textAlign: 'center',
    marginTop: sawaaSpacing.xs,
  },
  sectionTitle: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    color: colors.ink[900],
    paddingHorizontal: sawaaSpacing.xs,
  },
  itemRow: { alignItems: 'center', gap: sawaaSpacing.md },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: sawaaRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemMid: { flex: 1, gap: sawaaSpacing.xs },
  clientName: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[900],
  },
  timeRow: { alignItems: 'center', gap: sawaaSpacing.xs },
  timeText: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[500],
  },
  skeletonList: { gap: sawaaSpacing.md },
});
