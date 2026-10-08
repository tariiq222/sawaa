import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
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
  ChevronLeft,
  ChevronRight,
  Video,
} from 'lucide-react-native';

import { AquaBackground, sawaaRadius, sawaaType, withAlpha } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useClientBookings } from '@/hooks/queries';
import { goBackOrHome } from '@/lib/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import { useReduceMotion } from '@/hooks/useA11y';
import { resolveDeliveryType } from '@/types/booking-enums';

// status filter is uppercased by the service layer; backend mobile DTO
// validates the Prisma enum verbatim.
const COMPLETED_PARAMS = { status: 'completed', limit: 50 } as const;

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
  const colors = useSawaaColors();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const router = useRouter();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;

  const { data, isPending, isError, refetch } = useClientBookings(COMPLETED_PARAMS);
  const items = data?.items ?? [];
  // Only a pull-to-refresh shows the spinner; background refetches stay quiet.
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.teal[600]}
          />
        }
      >
        {/* A stack screen outside the tab group: a cold deep link has no history. */}
        <ScreenHeader
          title={t('records.title')}
          onBack={() => goBackOrHome(router, '/(client)/(tabs)/account')}
        />
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.subtitle, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
            {t('records.subtitle')}
          </Text>
        </Animated.View>

        {isPending ? (
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
        ) : isError ? (
          <EmptyState icon="clipboard-outline" title={t('records.loadError')} tone="danger"
            actionLabel={t('common.retry')} onAction={onRefresh} />
        ) : items.length === 0 ? (
          <EmptyState icon="calendar-outline" title={t('records.empty')} description={t('records.emptyHint')} />
        ) : (
          items.map((b, i) => {
            const gradient = theme.colors.primaryGradient;
            const therapistName = (dir.isRTL
              ? b.employee?.nameAr ?? b.employee?.nameEn
              : b.employee?.nameEn ?? b.employee?.nameAr) ?? '—';
            const serviceName = (dir.isRTL
              ? b.service?.nameAr ?? b.service?.nameEn
              : b.service?.nameEn ?? b.service?.nameAr) ?? '';
            const initial = therapistName.charAt(0);
            const isVideo = resolveDeliveryType(b.deliveryType) === 'online';

            return (
              <Animated.View
                key={b.id}
                entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(i, 6) * 40)
                  .duration(550)
                  .easing(Easing.out(Easing.cubic))}
              >
                <Glass variant="strong" radius={sawaaRadius.xl} style={styles.card}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={[therapistName, serviceName, formatDate(b.scheduledAt, dir.isRTL), formatTime(b.scheduledAt, dir.isRTL)].filter(Boolean).join('. ')}
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
                        <Text style={[styles.avatarText, { fontFamily: f700, color: theme.colors.primaryForeground }]}>
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
                              { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign },
                            ]}
                          >
                            {serviceName}
                          </Text>
                        ) : null}
                      </View>
                      <Chevron size={16} color={colors.ink[400]} strokeWidth={2} />
                    </View>

                    <View style={styles.divider} />

                    <View style={[styles.cardBottom, { flexDirection: dir.row }]}>
                      <View
                        style={[
                          styles.dateCol,
                          { alignItems: dir.isRTL ? 'flex-end' : 'flex-start' },
                        ]}
                      >
                        <Text style={[styles.dateLabel, { fontFamily: f400, fontWeight: '400' }]}>
                          {t('records.date')}
                        </Text>
                        <Text style={[styles.dateValue, { fontFamily: f600, fontWeight: '600' }]}>
                          {formatDate(b.scheduledAt, dir.isRTL)}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.dateCol,
                          { alignItems: dir.isRTL ? 'flex-end' : 'flex-start' },
                        ]}
                      >
                        <Text style={[styles.dateLabel, { fontFamily: f400, fontWeight: '400' }]}>
                          {t('records.time')}
                        </Text>
                        <Text style={[styles.dateValue, { fontFamily: f600, fontWeight: '600' }]}>
                          {formatTime(b.scheduledAt, dir.isRTL)}
                        </Text>
                      </View>
                      {isVideo ? (
                        <View
                          style={[
                            styles.tag,
                            { backgroundColor: withAlpha(colors.teal[600], 0.12) },
                          ]}
                        >
                          <Video
                            size={11}
                            color={colors.teal[700]}
                            strokeWidth={2}
                          />
                          <Text
                            style={[
                              styles.tagText,
                              { fontFamily: f600, fontWeight: '600', color: colors.teal[700] },
                            ]}
                          >
                            {t('records.video')}
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

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 14 },
  subtitle: {
    fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight,
    color: colors.ink[500],
    marginTop: 2,
    paddingHorizontal: 4,
  },
  skeletonWrap: { gap: 12, marginTop: 8 },
  skeletonCard: { height: 110, opacity: 0.55 },
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
  avatarText: { fontSize: 18, color: colors.ink[900] },
  cardMid: { flex: 1, minWidth: 0, flexShrink: 1 },
  therapist: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[900] },
  service: { fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight, color: colors.ink[500], marginTop: 3 },
  divider: { height: 0.5, backgroundColor: withAlpha(colors.ink[900], 0.1) },
  cardBottom: { flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dateCol: { gap: 2, flexShrink: 1, minWidth: 0 },
  dateLabel: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight, color: colors.ink[400] },
  dateValue: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight, color: colors.ink[900] },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  tagText: { fontSize: sawaaType.micro.fontSize, lineHeight: sawaaType.micro.lineHeight },
});
