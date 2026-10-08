import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, Calendar, Check, FileText, MessageCircle, Star, Video, type LucideIcon } from 'lucide-react-native';

import { AquaBackground, sawaaRadius, sawaaType, withAlpha } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Glass } from '@/theme/components/Glass';
import { GlassSegmented } from '@/components/ui/GlassSegmented';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Pill } from '@/components/ui/Pill';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useNotifications } from '@/hooks/use-notifications';
import { resolveNotificationHref } from '@/utils/notification-deeplink';
import { AppButton } from '@/components/ui/AppButton';
import { useReduceMotion } from '@/hooks/useA11y';
import { goBackOrHome } from '@/lib/navigation';
import { useTheme } from '@/theme/useTheme';
import type { Notification } from '@/types/models';

interface IconConfig {
  Icon: LucideIcon;
  color: string;
}

function iconForType(type: Notification['type'], colors: ReturnType<typeof useSawaaColors>): IconConfig {
  switch (type) {
    case 'booking_confirmed':
    case 'booking_completed':
      return { Icon: Check, color: colors.teal[600] };
    case 'booking_created':
      return { Icon: Calendar, color: colors.teal[600] };
    case 'booking_reminder':
    case 'booking_reminder_urgent':
    case 'reminder':
      return { Icon: Video, color: colors.teal[600] };
    case 'booking_rescheduled':
      return { Icon: Calendar, color: colors.accent.violet };
    case 'new_rating':
      return { Icon: Star, color: colors.accent.amber };
    case 'payment_received':
    case 'payment_completed':
    case 'payment_reminder':
      return { Icon: FileText, color: colors.accent.amber };
    case 'payment_failed':
      return { Icon: FileText, color: colors.accent.rose };
    case 'cancellation_requested':
    case 'cancellation_rejected':
    case 'booking_cancellation_rejected':
    case 'booking_cancelled':
    case 'booking_expired':
    case 'booking_no_show':
    case 'no_show_review':
    case 'client_arrived':
    case 'receipt_rejected':
      return { Icon: MessageCircle, color: colors.accent.rose };
    default:
      return { Icon: Bell, color: colors.teal[600] };
  }
}

function relativeWhen(iso: string, locale: 'ar' | 'en', t: TFunction): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return t('notifications.now');
  if (mins < 60) return t('notifications.minutesAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('notifications.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('notifications.daysAgo', { count: days });
  return new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', {
    day: 'numeric', month: 'short',
  });
}

const FILTERS = [
  { key: 'all', label: 'notifications.all' },
  { key: 'unread', label: 'notifications.unreadFilter' },
] as const;

type FilterKey = typeof FILTERS[number]['key'];

export default function NotificationsScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const { theme } = useTheme();
  const router = useRouter();
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');
  const localizedText = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const [active, setActive] = useState<FilterKey>('all');
  // This screen sits outside the tab group, so it must own its way back.

  const {
    notifications,
    unreadCount,
    loading,
    refreshing,
    refresh,
    loadMore,
    hasMore,
    loadingMore,
    loadError,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  // Refetch list each time the screen gains focus.
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const handlePress = useCallback(
    (n: Notification) => {
      if (!n.isRead) markAsRead(n.id);
      const href = resolveNotificationHref(n);
      if (href) router.push(href);
    },
    [markAsRead, router],
  );

  const visible = useMemo(() => {
    if (active === 'unread') return notifications.filter((n) => !n.isRead);
    return notifications;
  }, [active, notifications]);

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.teal[600]} />}
      >
        <ScreenHeader title={t('notifications.title')} onBack={() => goBackOrHome(router, '/(client)/(tabs)/account')} />

        {!loading && !loadError ? (
          <View style={[styles.summaryRow, { flexDirection: dir.row }]}>
            <Pill label={t('notifications.newCount', { count: unreadCount })} tone={unreadCount > 0 ? 'brand' : 'muted'} />
            {unreadCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('notifications.markAllRead')}
                onPress={markAllAsRead}
                hitSlop={8}
                style={styles.markAll}
              >
                <Text style={[styles.markAllText, { fontFamily: f700 }, localizedText]}>
                  {t('notifications.markAllRead')}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <GlassSegmented
          size="sm"
          appearance="navigation"
          options={FILTERS.map((f) => ({
            value: f.key,
            label: t(f.label),
            badge: String(f.key === 'unread' ? unreadCount : notifications.length),
          }))}
          value={active}
          onChange={setActive}
        />

        {visible.length === 0 && (loading || refreshing) ? (
          <View style={styles.paginationStatus} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.teal[600]} />
            <Text style={[styles.emptyText, { fontFamily: f400 }, localizedText]}>{t('common.loading')}</Text>
          </View>
        ) : visible.length === 0 && loadError ? null : visible.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyCircle}>
              <Bell size={44} color={colors.teal[700]} strokeWidth={1.75} />
            </View>
            <Text style={[styles.emptyTitle, { fontFamily: f700, textAlign: 'center' }]}>
              {t(active === 'unread' ? 'notifications.noUnread' : 'notifications.noNotifications')}
            </Text>
            {active === 'all' ? (
              <Text style={[styles.emptyText, { fontFamily: f400, textAlign: 'center' }]}>
                {t('notifications.noNotificationsDesc')}
              </Text>
            ) : null}
          </View>
        ) : (
          visible.map((n, i) => {
            const { Icon, color } = iconForType(n.type, colors);
            const title = (dir.isRTL ? n.titleAr : n.titleEn) || n.titleAr || n.titleEn;
            const body = (dir.isRTL ? n.bodyAr : n.bodyEn) || n.bodyAr || n.bodyEn;
            const when = relativeWhen(n.createdAt, dir.locale, t);
            const unread = !n.isRead;
            return (
              <Animated.View
                key={n.id}
                entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(i, 6) * 40).duration(500).easing(Easing.out(Easing.cubic))}
              >
                <Glass
                  variant="strong"
                  radius={sawaaRadius.lg}
                  style={styles.card}
                  onPress={() => handlePress(n)}
                  accessibilityLabel={[title, body, when, t(unread ? 'notifications.unread' : 'notifications.read')].filter(Boolean).join('. ')}
                >
                  <View style={[styles.row, { flexDirection: dir.row }]}>
                    <View style={[styles.iconBox, { backgroundColor: withAlpha(color, 0.13) }]}>
                      <Icon size={22} color={color} strokeWidth={1.75} />
                    </View>
                    <View style={styles.body}>
                      <Text style={[styles.itemTitle, { fontFamily: f700 }, localizedText]}>{title}</Text>
                      <Text style={[styles.itemBody, { fontFamily: f400, fontWeight: '400' }, localizedText]}>{body}</Text>
                      <Text style={[styles.when, { fontFamily: f400 }, localizedText]}>{when}</Text>
                    </View>
                    {unread ? <View style={styles.unreadDot} /> : null}
                  </View>
                </Glass>
              </Animated.View>
            );
          })
        )}

        {loadError ? (
          <View style={styles.paginationStatus}>
            <Text accessibilityRole="alert" style={[styles.paginationError, { fontFamily: f400, color: theme.colors.error }, localizedText]}>{t('notifications.loadError')}</Text>
            <AppButton label={t('common.retry')} variant="ghost" size="sm" onPress={loadMore} disabled={loadingMore} loading={loadingMore} />
          </View>
        ) : null}
        {hasMore && !loadError ? (
          <AppButton label={t('notifications.loadMore')}
            variant="secondary" onPress={loadMore} disabled={loadingMore} loading={loadingMore} />
        ) : null}
      </ScrollView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 12 },
  summaryRow: { flexWrap: 'wrap', gap: 8, alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  markAll: { minHeight: 44, justifyContent: 'center' },
  markAllText: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.teal[700] },
  card: { padding: 16 },
  row: { gap: 12, alignItems: 'flex-start' },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  itemTitle: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[900] },
  itemBody: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[700] },
  when: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight, color: colors.ink[500], marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.teal[500], marginTop: 6, flexShrink: 0 },
  empty: { alignItems: 'center', gap: 10, paddingTop: 48 },
  emptyCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(colors.teal[500], 0.14),
    marginBottom: 6,
  },
  emptyTitle: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight, color: colors.ink[900] },
  emptyText: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[700] },
  paginationStatus: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  paginationError: { fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight },
});
