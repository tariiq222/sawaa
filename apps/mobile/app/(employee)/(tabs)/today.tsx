import { useState, useEffect, useCallback } from 'react';
import { View, FlatList, Pressable, RefreshControl, StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Building2, Video, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AquaBackground,
  GlassSurface,
  sawaaColors,
  sawaaRadius,
  sawaaSemantic,
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
import { employeeBookingsService as bookingsService } from '@/services/employee/bookings';
import { getStatusLabel } from '@/lib/status-helpers';
import type { Booking } from '@/types/models';

const TYPE_ICON = {
  individual: Building2,
  in_person: Building2,
  online: Video,
  walk_in: Building2,
  group: Building2,
};

const TYPE_COLOR = {
  individual: sawaaSemantic.info,
  in_person: sawaaSemantic.info,
  online: sawaaColors.accent.violet,
  walk_in: sawaaSemantic.success,
  group: sawaaColors.accent.violet,
};

export default function TodayScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const user = useAppSelector((s) => s.auth.user);
  const router = useRouter();
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await bookingsService.getTodayBookings();
      if (res.data) setBookings(res.data.items);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
  const completed = bookings.filter((b) => b.status === 'completed').length;
  const remaining = confirmed;

  const stats: { label: string; value: number; color: string }[] = [
    { label: t('doctor.totalToday'), value: bookings.length, color: sawaaSemantic.info },
    { label: t('doctor.remaining'), value: remaining, color: sawaaSemantic.warning },
    { label: t('doctor.completedToday'), value: completed, color: sawaaSemantic.success },
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
        <GlassSurface variant="base" radius={sawaaRadius.xl} padding={sawaaSpacing.lg}>
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
                <Clock size={12} strokeWidth={1.5} color={sawaaColors.ink[400]} />
                <Text style={[styles.timeText, { writingDirection: dir.writingDirection }]}>
                  {item.startTime} — {item.endTime}
                </Text>
              </View>
            </View>
            <StatusPill status={item.status} label={t(getStatusLabel(item.status))} />
          </Pressable>
        </GlassSurface>
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
          <GlassSurface key={s.label} variant="base" radius={sawaaRadius.lg} padding={sawaaSpacing.md} style={styles.statCard}>
            {loading ? (
              <Skeleton width={36} height={24} radius={sawaaRadius.xs} style={styles.statSkeleton} />
            ) : (
              <Text style={[styles.statValue, { fontFamily: f700, color: s.color }]}>
                {dir.isRTL ? s.value.toLocaleString('ar-SA') : s.value}
              </Text>
            )}
            <Text style={[styles.statLabel, { fontFamily: f600, fontWeight: '600', writingDirection: dir.writingDirection }]}>
              {s.label}
            </Text>
          </GlassSurface>
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
  ) : (
    <EmptyState
      icon="calendar-outline"
      title={t('doctor.noAppointmentsToday')}
      description={dir.isRTL
        ? 'ستظهر مواعيدك الجديدة هنا عند إضافتها'
        : 'New appointments will appear here once scheduled'}
    />
  );

  return (
    <AquaBackground>
      <FlatList
        data={loading ? [] : bookings}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={sawaaColors.teal[600]} />
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

const styles = StyleSheet.create({
  list: { paddingHorizontal: sawaaSpacing.lg, paddingBottom: 140 },
  headerWrap: { gap: sawaaSpacing.lg, marginBottom: sawaaSpacing.lg },
  greetingBlock: { paddingHorizontal: sawaaSpacing.xs, marginTop: sawaaSpacing.xs },
  dateLabel: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: sawaaColors.teal[700],
    opacity: 0.75,
  },
  greeting: {
    fontSize: sawaaType.display.fontSize,
    lineHeight: sawaaType.display.lineHeight,
    color: sawaaColors.ink[900],
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
    color: sawaaColors.ink[500],
    textAlign: 'center',
    marginTop: sawaaSpacing.xs,
  },
  sectionTitle: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    color: sawaaColors.ink[900],
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
    color: sawaaColors.ink[900],
  },
  timeRow: { alignItems: 'center', gap: sawaaSpacing.xs },
  timeText: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: sawaaColors.ink[500],
  },
  skeletonList: { gap: sawaaSpacing.md },
});
