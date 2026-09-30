import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, Calendar, Check, CheckCheck, FileText, MessageCircle, Star, Video, type LucideIcon } from 'lucide-react-native';

import { AquaBackground, sawaaRadius, withAlpha } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Glass } from '@/theme/components/Glass';
import { GlassSegmented } from '@/components/ui/GlassSegmented';
import { BackButton } from '@/components/ui/BackButton';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useNotifications } from '@/hooks/use-notifications';
import { resolveNotificationHref } from '@/utils/notification-deeplink';
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
  const router = useRouter();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.teal[600]} />}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <View style={[styles.headerRow, { flexDirection: dir.row }]}>
            <BackButton onPress={() => router.back()} />
            <View style={styles.headerText}>
              <Text style={[styles.title, { fontFamily: f700 }, localizedText]}>
                {t('notifications.title')}
              </Text>
              {!loading && !loadError ? (
                <Text style={[styles.subtitle, { fontFamily: f400, fontWeight: '400' }, localizedText]}>
                  {t('notifications.newCount', { count: unreadCount })}
                </Text>
              ) : null}
            </View>
            {unreadCount > 0 ? (
              <Glass variant="regular" radius={20} onPress={markAllAsRead} interactive style={styles.markAllBtn}
                accessibilityRole="button" accessibilityLabel={t('notifications.markAllRead')}>
                <View style={[styles.markAllInner, { flexDirection: dir.row }]}>
                  <CheckCheck size={14} color={colors.teal[700]} strokeWidth={2} />
                  <Text style={[styles.markAllText, { fontFamily: f600, fontWeight: '600' }, localizedText]}>
                    {t('notifications.markAllRead')}
                  </Text>
                </View>
              </Glass>
            ) : null}
          </View>
        </Animated.View>

        {/* Filter chips */}
        <Animated.View entering={FadeInDown.delay(100).duration(600).easing(Easing.out(Easing.cubic))}>
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
        </Animated.View>

        {/* List */}
        {visible.length === 0 && (loading || refreshing) ? (
          <View style={styles.paginationStatus} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.teal[600]} />
            <Text style={[styles.emptyText, { fontFamily: f400 }, localizedText]}>{t('common.loading')}</Text>
          </View>
        ) : visible.length === 0 && loadError ? null : visible.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(150).duration(600).easing(Easing.out(Easing.cubic))}>
            <Glass variant="regular" radius={sawaaRadius.xl} style={styles.empty}>
              <Bell size={20} color={colors.ink[400]} strokeWidth={1.75} />
              <Text style={[styles.emptyText, { fontFamily: f400, fontWeight: '400' }, localizedText]}>
                {t(active === 'unread' ? 'notifications.noUnread' : 'notifications.noNotifications')}
              </Text>
            </Glass>
          </Animated.View>
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
                entering={FadeInDown.delay(150 + i * 50).duration(600).easing(Easing.out(Easing.cubic))}
              >
                <Glass
                  variant="regular"
                  radius={sawaaRadius.xl}
                  style={styles.card}
                  onPress={() => handlePress(n)}
                  accessibilityLabel={[title, body, when, t(unread ? 'notifications.unread' : 'notifications.read')].filter(Boolean).join('. ')}
                >
                  <View style={[styles.row, { flexDirection: dir.row }]}>
                    <View style={[
                      styles.iconBox,
                      { backgroundColor: withAlpha(color, 0.13), borderColor: withAlpha(color, 0.2) },
                    ]}>
                      <Icon size={18} color={color} strokeWidth={1.75} />
                    </View>
                    <View style={styles.body}>
                      <Text style={[styles.itemTitle, { fontFamily: f700 }, localizedText]}>
                        {title}
                      </Text>
                      <Text style={[styles.itemBody, { fontFamily: f400, fontWeight: '400' }, localizedText]}>
                        {body}
                      </Text>
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
            <Text accessibilityRole="alert" style={[styles.paginationError, { fontFamily: f400 }, localizedText]}>{t('notifications.loadError')}</Text>
            <Pressable accessibilityRole="button" onPress={loadMore} disabled={loadingMore} style={styles.paginationButton}>
              <Text style={[styles.paginationAction, { fontFamily: f600 }, localizedText]}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : null}
        {hasMore && !loadError ? (
          <Pressable
            accessibilityRole="button"
            onPress={loadMore}
            disabled={loadingMore}
            style={styles.paginationButton}
          >
            {loadingMore ? (
              <View style={[styles.loadingMore, { flexDirection: dir.row }]}>
                <ActivityIndicator color={colors.teal[600]} />
                <Text style={[styles.paginationAction, { fontFamily: f400 }, localizedText]}>{t('notifications.loadingMore')}</Text>
              </View>
            ) : (
              <Text style={[styles.paginationAction, { fontFamily: f600 }, localizedText]}>{t('notifications.loadMore')}</Text>
            )}
          </Pressable>
        ) : null}
      </ScrollView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 12 },
  headerRow: { justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingHorizontal: 4 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: 28, color: colors.ink[900] },
  subtitle: { fontSize: 12.5, color: colors.ink[500], marginTop: 2 },
  markAllBtn: { marginTop: 6, maxWidth: '45%', flexShrink: 1 },
  markAllInner: { minHeight: 44, alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  markAllText: { flexShrink: 1, fontSize: 12, color: colors.teal[700] },
  card: { padding: 14 },
  row: { gap: 12, alignItems: 'flex-start' },
  iconBox: {
    width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, flexShrink: 0,
  },
  body: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: 13.5, color: colors.ink[900] },
  when: { fontSize: 10.5, color: colors.ink[500], marginTop: 8 },
  itemBody: { fontSize: 12, color: colors.ink[700], marginTop: 3, lineHeight: 18 },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.teal[500], marginTop: 6, flexShrink: 0 },
  empty: { padding: 28, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 12.5, color: colors.ink[500] },
  paginationButton: { alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  paginationStatus: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  loadingMore: { alignItems: 'center', gap: 8 },
  paginationError: { fontSize: 12, color: colors.accent.rose },
  paginationAction: { fontSize: 13, color: colors.teal[700] },
});
