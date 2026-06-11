import React from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, Users } from 'lucide-react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { useBookGroupSession, useGroupSession } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import { AquaBackground, PrimaryButton, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { ThemedText } from '@/theme/components/ThemedText';
import { concentricRadius } from '@/theme/sawaa/tokens';

const CARD_RADIUS = sawaaRadius.xl;
const CARD_PADDING = 18;

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

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const groupQuery = useGroupSession(id);
  const book = useBookGroupSession();
  const group = groupQuery.data;
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const backSymbol = (dir.isRTL ? 'chevron.right' : 'chevron.left') as React.ComponentProps<typeof AppIcon>['sf'];

  const isWaitlist = Boolean(group?.isFull && group.waitlistEnabled);
  const isClosed = Boolean(group?.isFull && !group.waitlistEnabled);
  const ctaLabel = isWaitlist ? t('groups.joinWaitlist') : isClosed ? t('groups.full') : t('groups.join');
  const description = group ? (dir.isRTL ? group.descriptionAr : group.descriptionEn ?? group.descriptionAr) : null;

  const onJoin = () => {
    if (!id) return;
    book.mutate(id, {
      onSuccess: (res) => {
        if (res.type === 'BOOKED') Alert.alert(t('groups.title'), t('groups.booked'));
        else Alert.alert(t('groups.title'), t('groups.waitlisted', { position: res.waitlistPosition ?? '-' }));
      },
      onError: () => Alert.alert(t('groups.title'), t('groups.bookError')),
    });
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerRow, { flexDirection: dir.row }]}> 
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
            <AppIcon sf={backSymbol} fallback={BackIcon} size={24} color={sawaaColors.ink[900]} strokeWidth={1.5} />
          </Pressable>
          <ThemedText variant="subheading">{t('groups.title')}</ThemedText>
          <View style={styles.backBtn} />
        </View>

        {groupQuery.isLoading ? (
          <View style={styles.centerState}><ActivityIndicator color={sawaaColors.teal[600]} /></View>
        ) : groupQuery.isError || !group ? (
          <View style={styles.centerState}><ThemedText variant="bodySm" align="center">{t('groups.bookError')}</ThemedText></View>
        ) : (
          <Glass variant="strong" radius={CARD_RADIUS} style={styles.heroCard}>
            <View style={[styles.heroTop, { flexDirection: dir.row }]}> 
              <View style={styles.iconWrap}>
                <AppIcon sf="person.3.fill" fallback={Users} size={28} color={sawaaColors.teal[700]} strokeWidth={1.6} />
              </View>
              <View style={styles.titleBlock}>
                <ThemedText variant="heading" style={{ textAlign: dir.textAlign }}>
                  {group.title}
                </ThemedText>
                {description ? (
                  <ThemedText variant="bodySm" color={sawaaColors.ink[700]} style={{ textAlign: dir.textAlign }}>
                    {description}
                  </ThemedText>
                ) : null}
              </View>
            </View>

            <View style={styles.detailsGrid}>
              <DetailRow icon="calendar" label={formatDateTime(group.scheduledAt, dir.isRTL)} dir={dir} />
              <DetailRow icon="duration" label={t('groups.duration', { count: group.durationMins })} dir={dir} />
              <DetailRow icon="users" label={t('groups.enrolled', { count: group.enrolledCount, max: group.maxCapacity })} dir={dir} />
              <DetailRow icon="price" label={formatPrice(group.price, dir.isRTL, t('home.sar'))} dir={dir} />
            </View>

            <View style={[styles.badgeRow, { flexDirection: dir.row }]}> 
              {isWaitlist ? <StateBadge label={t('groups.waitlist')} tone="waitlist" /> : null}
              {isClosed ? <StateBadge label={t('groups.full')} tone="muted" /> : null}
              {!group.isFull ? <StateBadge label={t('groups.spotsLeft', { count: group.spotsLeft })} tone="open" /> : null}
            </View>
          </Glass>
        )}
      </ScrollView>

      {group ? (
        <View style={[styles.ctaWrap, { bottom: insets.bottom + 20 }]}> 
          <Glass variant="strong" radius={sawaaRadius.pill} style={styles.ctaPill}>
            <PrimaryButton
              label={ctaLabel}
              onPress={onJoin}
              disabled={book.isPending || isClosed}
              height={50}
            />
          </Glass>
        </View>
      ) : null}
    </AquaBackground>
  );
}

function DetailRow({ icon, label, dir }: { icon: 'calendar' | 'duration' | 'price' | 'users'; label: string; dir: ReturnType<typeof useDir> }) {
  const config = {
    calendar: { sf: 'calendar' as const, fallback: CalendarDays },
    duration: { sf: 'clock.fill' as const, fallback: Clock3 },
    price: { sf: 'banknote.fill' as const, fallback: CircleDollarSign },
    users: { sf: 'person.2.fill' as const, fallback: Users },
  }[icon];
  return (
    <View style={[styles.detailRow, { flexDirection: dir.row }]}> 
      <AppIcon sf={config.sf} fallback={config.fallback} size={16} color={sawaaColors.teal[700]} strokeWidth={1.6} />
      <ThemedText variant="body" style={{ textAlign: dir.textAlign, flex: 1 }}>{label}</ThemedText>
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
  scroll: { paddingHorizontal: 24, gap: 14 },
  headerRow: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  centerState: { minHeight: 260, alignItems: 'center', justifyContent: 'center' },
  heroCard: { padding: CARD_PADDING, gap: 18 },
  heroTop: { gap: 14, alignItems: 'flex-start' },
  iconWrap: {
    width: 58,
    height: 58,
    borderRadius: concentricRadius(CARD_RADIUS, CARD_PADDING),
    backgroundColor: sawaaColors.glass.bgStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: { flex: 1, gap: 8 },
  detailsGrid: { gap: 10 },
  detailRow: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: sawaaRadius.md,
    backgroundColor: sawaaColors.glass.bgSoft,
  },
  badgeRow: { flexWrap: 'wrap', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: sawaaRadius.pill, borderWidth: 0.5 },
  ctaWrap: { position: 'absolute', start: 16, end: 16 },
  ctaPill: { padding: 6 },
});
