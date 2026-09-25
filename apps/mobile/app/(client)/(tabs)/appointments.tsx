import React, { useMemo, useState, useCallback } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Video,
  XCircle,
} from 'lucide-react-native';

import {
  AquaBackground,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
  withAlpha,
} from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassSegmented } from '@/components/ui/GlassSegmented';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useClientBookings, clientBookingsKeys } from '@/hooks/queries';
import { type ClientBookingStatus } from '@/services/client';
import { useReduceMotion } from '@/hooks/useA11y';
import { resolveDeliveryType } from '@/types/booking-enums';

type TabKey = 'upcoming' | 'past' | 'cancelled';

const TABS: { key: TabKey; ar: string; en: string }[] = [
  { key: 'upcoming', ar: 'قادمة', en: 'Upcoming' },
  { key: 'past', ar: 'منتهية', en: 'Completed' },
  { key: 'cancelled', ar: 'ملغاة', en: 'Cancelled' },
];

function tabOf(status: ClientBookingStatus): TabKey {
  if (status === 'cancelled' || status === 'cancel_requested' || status === 'expired') {
    return 'cancelled';
  }
  if (status === 'completed' || status === 'no_show') return 'past';
  return 'upcoming';
}

function formatDate(iso: string, isRTL: boolean) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatTime(iso: string, isRTL: boolean) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', {
    hour: 'numeric', minute: '2-digit',
  });
}

export default function AppointmentsScreen() {
  const colors = useSawaaColors();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const router = useRouter();
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const [tab, setTab] = useState<TabKey>('upcoming');
  const queryClient = useQueryClient();
  const { data, isLoading, isError, isRefetching, refetch } = useClientBookings({ limit: 50 });
  const bookings = data?.items ?? [];
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;

  const items = useMemo(
    () => bookings.filter((b) => tabOf(b.status) === tab),
    [bookings, tab],
  );

  const onRefresh = () => {
    queryClient.invalidateQueries({ queryKey: clientBookingsKeys.all });
    refetch();
  };

  const statusConfig: Record<TabKey, { icon: React.ReactNode; color: string }> = {
    upcoming: { icon: <Clock size={12} color={colors.accent.sky} strokeWidth={2} />, color: colors.accent.sky },
    past: { icon: <CheckCircle2 size={12} color={colors.teal[500]} strokeWidth={2} />, color: colors.teal[500] },
    cancelled: { icon: <XCircle size={12} color={colors.accent.coral} strokeWidth={2} />, color: colors.accent.coral },
  };

  const renderItem = useCallback(({ item: b, index: i }: { item: typeof bookings[0]; index: number }) => {
    const status: TabKey = tabOf(b.status);
    const gradient = theme.colors.primaryGradient;
    const therapistName = (dir.isRTL
      ? b.employee?.nameAr ?? b.employee?.nameEn
      : b.employee?.nameEn ?? b.employee?.nameAr) ?? '—';
    const initial = therapistName.charAt(0);
    const isVideo = resolveDeliveryType(b.deliveryType) === 'online';
    const location = isVideo
      ? (dir.isRTL ? 'جلسة عن بُعد' : 'Remote session')
      : (dir.isRTL ? b.branch?.nameAr ?? b.branch?.nameEn ?? '' : b.branch?.nameEn ?? b.branch?.nameAr ?? '');

    return (
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.delay(180 + i * 70).duration(600).easing(Easing.out(Easing.cubic))}
      >
        <Glass variant="strong" radius={sawaaRadius.xl} style={styles.card}>
          <Pressable
            onPress={() => router.push(`/(client)/appointment/${b.id}`)}
            style={styles.cardInner}
            accessibilityRole="button"
            accessibilityLabel={`${dir.isRTL ? 'موعد مع' : 'Appointment with'} ${therapistName} ${dir.isRTL ? 'في' : 'on'} ${formatDate(b.scheduledAt, dir.isRTL)}`}
            accessibilityHint={t('a11y.cardOpenAppointment')}
            testID={`appt-${b.id}`}
          >
            <View style={[styles.cardTop, { flexDirection: dir.row }]}>
              <LinearGradient
                colors={gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={[styles.avatarText, { fontFamily: f700, color: theme.colors.primaryForeground }]}>{initial}</Text>
              </LinearGradient>
              <View style={styles.cardMid}>
                <Text style={[styles.therapist, { fontFamily: f700, textAlign: dir.textAlign }]}>
                  {therapistName}
                </Text>
                <View style={[styles.metaRow, { flexDirection: dir.row }]}>
                  {isVideo ? (
                    <Video size={12} color={colors.teal[600]} strokeWidth={2} />
                  ) : (
                    <MapPin size={12} color={colors.accent.violet} strokeWidth={2} />
                  )}
                  <Text style={[styles.metaText, { fontFamily: f500, fontWeight: '500' }]}>{location}</Text>
                </View>
              </View>
              <Chevron size={16} color={colors.ink[400]} strokeWidth={2} />
            </View>

            <View style={styles.divider} />

            <View style={[styles.cardBottom, { flexDirection: dir.row }]}>
              <View style={[styles.dateCol, { alignItems: dir.isRTL ? 'flex-end' : 'flex-start' }]}>
                <Text style={[styles.dateLabel, { fontFamily: f400, fontWeight: '400' }]}>
                  {dir.isRTL ? 'التاريخ' : 'Date'}
                </Text>
                <Text style={[styles.dateValue, { fontFamily: f600, fontWeight: '600' }]}>
                  {formatDate(b.scheduledAt, dir.isRTL)}
                </Text>
              </View>
              <View style={[styles.dateCol, { alignItems: dir.isRTL ? 'flex-end' : 'flex-start' }]}>
                <Text style={[styles.dateLabel, { fontFamily: f400, fontWeight: '400' }]}>
                  {dir.isRTL ? 'الوقت' : 'Time'}
                </Text>
                <Text style={[styles.dateValue, { fontFamily: f600, fontWeight: '600' }]}>
                  {formatTime(b.scheduledAt, dir.isRTL)}
                </Text>
              </View>
              <View style={[styles.statusChip, { backgroundColor: withAlpha(statusConfig[status].color, 0.12) }]}>
                {statusConfig[status].icon}
                <Text style={[
                  styles.statusChipText,
                  { fontFamily: f600, fontWeight: '600', color: statusConfig[status].color },
                ]}>
                  {dir.isRTL ? TABS.find((t) => t.key === status)!.ar : TABS.find((t) => t.key === status)!.en}
                </Text>
              </View>
            </View>
          </Pressable>
        </Glass>
      </Animated.View>
    );
  }, [Chevron, colors, styles, theme, dir, f400, f500, f600, f700, reduceMotion, router, statusConfig, t]);

  const ListHeader = useMemo(() => (
    <View style={styles.header}>
      <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
        <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
          {dir.isRTL ? 'مواعيدي' : 'Appointments'}
        </Text>
        <Text style={[styles.subtitle, { fontFamily: f500, fontWeight: '500', textAlign: dir.textAlign }]}>
          {dir.isRTL ? 'جلساتك الحالية والسابقة' : 'Your upcoming and past sessions'}
        </Text>
      </Animated.View>

      <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(100).duration(600).easing(Easing.out(Easing.cubic))}>
        <GlassSegmented
          size="sm"
          options={TABS.map((tabItem) => ({
            value: tabItem.key,
            label: dir.isRTL ? tabItem.ar : tabItem.en,
          }))}
          value={tab}
          onChange={setTab}
        />
      </Animated.View>
    </View>
  ), [styles, dir, f500, f700, reduceMotion, tab]);

  const ListEmpty = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.skeletonWrap}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={`appt-skeleton-${i}`} height={132} radius={sawaaRadius.xl} />
          ))}
        </View>
      );
    }
    if (isError) {
      return (
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(200).duration(600)}>
          <EmptyState
            icon="cloud-offline-outline"
            tone="danger"
            title={dir.isRTL ? 'تعذّر تحميل المواعيد' : 'Could not load appointments'}
            description={dir.isRTL ? 'تحققي من الاتصال ثم حاولي مرة أخرى' : 'Check your connection and try again'}
            actionLabel={t('common.retry')}
            onAction={() => refetch()}
          />
        </Animated.View>
      );
    }
    return (
      <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(200).duration(600)}>
        <EmptyState
          icon="calendar-outline"
          title={dir.isRTL ? 'لا توجد مواعيد' : 'No appointments'}
          description={dir.isRTL ? 'مواعيدك الجديدة ستظهر هنا' : 'Your new appointments will appear here'}
        />
      </Animated.View>
    );
  }, [styles, dir.isRTL, isError, isLoading, reduceMotion, refetch, t]);

  return (
    <AquaBackground>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
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

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg },
  header: { gap: sawaaSpacing.lg, marginBottom: sawaaSpacing.lg },
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: colors.ink[900],
    paddingHorizontal: sawaaSpacing.xs,
  },
  subtitle: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[500],
    marginTop: 2,
    paddingHorizontal: sawaaSpacing.xs,
  },
  skeletonWrap: { gap: sawaaSpacing.md, marginTop: sawaaSpacing.sm },
  card: { padding: 0, marginBottom: sawaaSpacing.lg },
  cardInner: { padding: sawaaSpacing.md, gap: sawaaSpacing.md },
  cardTop: { alignItems: 'center', gap: sawaaSpacing.md },
  avatar: {
    width: 44, height: 44, borderRadius: sawaaRadius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    color: colors.ink[900],
  },
  cardMid: { flex: 1 },
  therapist: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[900],
  },
  metaRow: { alignItems: 'center', gap: sawaaSpacing.xs, marginTop: 2 },
  metaText: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: colors.ink[500],
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: withAlpha(colors.ink[900], 0.1) },
  cardBottom: { alignItems: 'center', justifyContent: 'space-between', gap: sawaaSpacing.sm },
  dateCol: { gap: 2 },
  dateLabel: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: colors.ink[400],
  },
  dateValue: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[900],
  },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: sawaaSpacing.xs,
    paddingHorizontal: sawaaSpacing.sm, paddingVertical: sawaaSpacing.xs, borderRadius: sawaaRadius.sm,
  },
  statusChipText: { fontSize: sawaaType.micro.fontSize, lineHeight: sawaaType.micro.lineHeight },
});
