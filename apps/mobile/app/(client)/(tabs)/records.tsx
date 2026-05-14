import React, { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Video,
} from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import {
  clientBookingsService,
  type ClientBookingRow,
} from '@/services/client';

const GRADIENTS: Array<readonly [string, string]> = [
  ['#f7cbb7', '#e88f6c'],
  ['#c9e4ff', '#7aa8e0'],
  ['#d4c8f0', '#8c78d0'],
  ['#ffd5a8', '#e09b5a'],
  ['#b8e4d6', '#5aa893'],
];

function hashGradient(id: string) {
  let h = 0;
  for (const ch of id) h = (h + ch.charCodeAt(0)) % GRADIENTS.length;
  return GRADIENTS[h];
}

function formatDate(iso: string, isRTL: boolean) {
  return new Date(iso).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(iso: string, isRTL: boolean) {
  return new Date(iso).toLocaleTimeString(isRTL ? 'ar-SA' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function RecordsScreen() {
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const router = useRouter();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;

  const [items, setItems] = useState<ClientBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      // status filter is uppercased by the service layer; backend mobile DTO
      // validates the Prisma enum verbatim.
      const res = await clientBookingsService.list({
        status: 'completed',
        limit: 50,
      });
      setItems(res.items);
    } catch {
      setError(dir.isRTL ? 'تعذّر تحميل السجلات' : 'Failed to load records');
      setItems([]);
    }
  }, [dir.isRTL]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 20, paddingBottom: 140 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={sawaaColors.teal[600]}
          />
        }
      >
        <Animated.View entering={FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'السجلات' : 'Records'}
          </Text>
          <Text style={[styles.subtitle, { fontFamily: f400, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'جلساتك السابقة وملاحظاتها' : 'Your past sessions and notes'}
          </Text>
        </Animated.View>

        {loading ? (
          <View style={styles.skeletonWrap}>
            {[0, 1, 2].map((i) => (
              <Glass
                key={`skeleton-${i}`}
                variant="regular"
                radius={sawaaRadius.xl}
                style={styles.skeletonCard}
              />
            ))}
          </View>
        ) : error ? (
          <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.empty}>
            <ClipboardList size={40} color={sawaaColors.accent.coral} strokeWidth={1.5} />
            <Text style={[styles.emptyText, { fontFamily: f600 }]}>{error}</Text>
            <Pressable onPress={onRefresh} style={styles.retryBtn}>
              <Text style={[styles.retryText, { fontFamily: f600 }]}>
                {dir.isRTL ? 'إعادة المحاولة' : 'Retry'}
              </Text>
            </Pressable>
          </Animated.View>
        ) : items.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.empty}>
            <CalendarCheck size={40} color={sawaaColors.ink[400]} strokeWidth={1.5} />
            <Text style={[styles.emptyText, { fontFamily: f600 }]}>
              {dir.isRTL ? 'لا توجد جلسات سابقة بعد' : 'No past sessions yet'}
            </Text>
            <Text style={[styles.emptyHint, { fontFamily: f400 }]}>
              {dir.isRTL
                ? 'ستظهر هنا الجلسات المكتملة'
                : 'Completed sessions will appear here'}
            </Text>
          </Animated.View>
        ) : (
          items.map((b, i) => {
            const gradient = hashGradient(b.id);
            const therapistName = (dir.isRTL
              ? b.employee?.nameAr ?? b.employee?.nameEn
              : b.employee?.nameEn ?? b.employee?.nameAr) ?? '—';
            const serviceName = (dir.isRTL
              ? b.service?.nameAr ?? b.service?.nameEn
              : b.service?.nameEn ?? b.service?.nameAr) ?? '';
            const initial = therapistName.charAt(0);
            const isVideo = b.bookingType === 'online';

            return (
              <Animated.View
                key={b.id}
                entering={FadeInDown.delay(120 + i * 60)
                  .duration(550)
                  .easing(Easing.out(Easing.cubic))}
              >
                <Glass variant="strong" radius={sawaaRadius.xl} style={styles.card}>
                  <Pressable
                    onPress={() => router.push(`/(client)/appointment/${b.id}`)}
                    style={styles.cardInner}
                  >
                    <View style={[styles.cardTop, { flexDirection: dir.row }]}>
                      <LinearGradient
                        colors={gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.avatar}
                      >
                        <Text style={[styles.avatarText, { fontFamily: f700 }]}>
                          {initial}
                        </Text>
                      </LinearGradient>
                      <View style={styles.cardMid}>
                        <Text
                          style={[
                            styles.therapist,
                            { fontFamily: f700, textAlign: dir.textAlign },
                          ]}
                        >
                          {therapistName}
                        </Text>
                        {serviceName ? (
                          <Text
                            style={[
                              styles.service,
                              { fontFamily: f400, textAlign: dir.textAlign },
                            ]}
                            numberOfLines={1}
                          >
                            {serviceName}
                          </Text>
                        ) : null}
                      </View>
                      <Chevron size={16} color={sawaaColors.ink[400]} strokeWidth={2} />
                    </View>

                    <View style={styles.divider} />

                    <View style={[styles.cardBottom, { flexDirection: dir.row }]}>
                      <View
                        style={[
                          styles.dateCol,
                          { alignItems: dir.isRTL ? 'flex-end' : 'flex-start' },
                        ]}
                      >
                        <Text style={[styles.dateLabel, { fontFamily: f400 }]}>
                          {dir.isRTL ? 'التاريخ' : 'Date'}
                        </Text>
                        <Text style={[styles.dateValue, { fontFamily: f600 }]}>
                          {formatDate(b.scheduledAt, dir.isRTL)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.dateCol,
                          { alignItems: dir.isRTL ? 'flex-end' : 'flex-start' },
                        ]}
                      >
                        <Text style={[styles.dateLabel, { fontFamily: f400 }]}>
                          {dir.isRTL ? 'الوقت' : 'Time'}
                        </Text>
                        <Text style={[styles.dateValue, { fontFamily: f600 }]}>
                          {formatTime(b.scheduledAt, dir.isRTL)}
                        </Text>
                      </View>
                      {isVideo ? (
                        <View
                          style={[
                            styles.tag,
                            { backgroundColor: `${sawaaColors.teal[600]}1e` },
                          ]}
                        >
                          <Video
                            size={11}
                            color={sawaaColors.teal[700]}
                            strokeWidth={2}
                          />
                          <Text
                            style={[
                              styles.tagText,
                              { fontFamily: f600, color: sawaaColors.teal[700] },
                            ]}
                          >
                            {dir.isRTL ? 'فيديو' : 'Video'}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                </Glass>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 14 },
  title: { fontSize: 26, color: sawaaColors.ink[900], paddingHorizontal: 4 },
  subtitle: {
    fontSize: 12.5,
    color: sawaaColors.ink[500],
    marginTop: 2,
    paddingHorizontal: 4,
  },
  skeletonWrap: { gap: 12, marginTop: 8 },
  skeletonCard: { height: 110, opacity: 0.55 },
  empty: { alignItems: 'center', paddingVertical: 64, gap: 10 },
  emptyText: { fontSize: 14, color: sawaaColors.ink[700] },
  emptyHint: { fontSize: 12, color: sawaaColors.ink[500] },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: `${sawaaColors.teal[600]}26`,
  },
  retryText: { fontSize: 12.5, color: sawaaColors.teal[700] },
  card: { padding: 0 },
  cardInner: { padding: 14, gap: 12 },
  cardTop: { alignItems: 'center', gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, color: 'rgba(255,255,255,0.95)' },
  cardMid: { flex: 1 },
  therapist: { fontSize: 14, color: sawaaColors.ink[900] },
  service: { fontSize: 11.5, color: sawaaColors.ink[500], marginTop: 3 },
  divider: { height: 0.5, backgroundColor: 'rgba(10,60,60,0.1)' },
  cardBottom: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dateCol: { gap: 2 },
  dateLabel: { fontSize: 10.5, color: sawaaColors.ink[400] },
  dateValue: { fontSize: 12.5, color: sawaaColors.ink[900] },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tagText: { fontSize: 10.5 },
});
