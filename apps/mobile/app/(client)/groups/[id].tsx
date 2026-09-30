import React, { useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CalendarDays, CircleDollarSign, Clock3, Users } from 'lucide-react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { BackButton } from '@/components/ui/BackButton';
import { useBookGroupSession, useGroupSession } from '@/hooks/queries';
import { resolveEnrollmentNextStep } from '@/services/client/group-sessions';
import { useDir } from '@/hooks/useDir';
import { AquaBackground, PrimaryButton, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { ThemedText } from '@/theme/components/ThemedText';
import { concentricRadius, withAlpha } from '@/theme/sawaa/tokens';

const CARD_RADIUS = sawaaRadius.xl;
const CARD_PADDING = 18;

function formatDateTime(value: string, isRTL: boolean): string | null {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(isRTL ? 'ar-SA' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(isRTL ? { calendar: 'gregory' } : {}),
  }).format(date);
}

function formatPrice(price: number, isRTL: boolean, sar: string) {
  return `${new Intl.NumberFormat(isRTL ? 'ar-SA' : 'en-US').format(price / 100)} ${sar}`;
}

export default function GroupDetailScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const groupQuery = useGroupSession(id);
  const book = useBookGroupSession();
  const group = groupQuery.data;

  const isClosed = Boolean(group?.isFull);
  // Keep the enrollment action available when a program is full: the server
  // can return an existing active enrollment for this client, which is the
  // recovery path for a previously reserved place.
  const ctaLabel = t('groups.joinSession');
  // Public copy wins; the internal description is only a fallback.
  const description = group
    ? (dir.isRTL
      ? group.publicDescriptionAr ?? group.descriptionAr
      : group.publicDescriptionEn ?? group.descriptionEn ?? group.publicDescriptionAr ?? group.descriptionAr)
    : null;

  const onJoin = () => {
    if (!id) return;
    book.mutate(id, {
      onSuccess: (enrollment) => {
        const nextStep = resolveEnrollmentNextStep(enrollment);
        if (nextStep === 'checkout' && enrollment.invoiceId) {
          router.replace({
            pathname: '/(client)/booking/checkout',
            params: {
              bookingId: enrollment.bookingId,
              invoiceId: enrollment.invoiceId,
              programId: id,
            },
          });
          return;
        }
        if (nextStep === 'confirmed') {
          Alert.alert(t('groups.title'), t('groups.booked'));
          return;
        }
        Alert.alert(t('groups.title'), t('groups.invoiceMissing'));
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
          <BackButton onPress={() => router.back()} />
          <ThemedText variant="subheading">{t('groups.title')}</ThemedText>
          <View style={styles.backBtn} />
        </View>

        {groupQuery.isLoading ? (
          <View style={styles.centerState}><ActivityIndicator color={colors.teal[600]} /></View>
        ) : groupQuery.isError || !group ? (
          <View style={styles.centerState}><ThemedText variant="bodySm" align="center">{t('groups.bookError')}</ThemedText></View>
        ) : (
          <Glass variant="strong" radius={CARD_RADIUS} style={styles.heroCard}>
            <View style={[styles.heroTop, { flexDirection: dir.row }]}> 
              <View style={styles.iconWrap}>
                <AppIcon sf="person.3.fill" fallback={Users} size={28} color={colors.teal[700]} strokeWidth={1.6} />
              </View>
              <View style={styles.titleBlock}>
                <ThemedText variant="heading" style={{ textAlign: dir.textAlign }}>
                  {group.title}
                </ThemedText>
                {description ? (
                  <ThemedText variant="bodySm" color={colors.ink[700]} style={{ textAlign: dir.textAlign }}>
                    {description}
                  </ThemedText>
                ) : null}
              </View>
            </View>

            <View style={styles.detailsGrid}>
              {group.scheduledAt ? (
                <DetailRow icon="calendar" label={formatDateTime(group.scheduledAt, dir.isRTL) ?? t('groups.dateTba')} dir={dir} />
              ) : (
                <DetailRow icon="calendar" label={t('groups.dateTba')} dir={dir} />
              )}
              <DetailRow icon="duration" label={t('groups.duration', { count: group.durationMins ?? 0 })} dir={dir} />
              <DetailRow icon="users" label={t('groups.enrolled', { count: group.enrolledCount, max: group.maxCapacity ?? 0 })} dir={dir} />
              <DetailRow icon="price" label={formatPrice(Number(group.price), dir.isRTL, t('home.sar'))} dir={dir} />
            </View>

            <View style={[styles.badgeRow, { flexDirection: dir.row }]}>
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
              disabled={book.isPending}
              height={50}
            />
          </Glass>
        </View>
      ) : null}
    </AquaBackground>
  );
}

function DetailRow({ icon, label, dir }: { icon: 'calendar' | 'duration' | 'price' | 'users'; label: string; dir: ReturnType<typeof useDir> }) {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const config = {
    calendar: { sf: 'calendar' as const, fallback: CalendarDays },
    duration: { sf: 'clock.fill' as const, fallback: Clock3 },
    price: { sf: 'banknote.fill' as const, fallback: CircleDollarSign },
    users: { sf: 'person.2.fill' as const, fallback: Users },
  }[icon];
  return (
    <View style={[styles.detailRow, { flexDirection: dir.row }]}> 
      <AppIcon sf={config.sf} fallback={config.fallback} size={16} color={colors.teal[700]} strokeWidth={1.6} />
      <ThemedText variant="body" style={{ textAlign: dir.textAlign, flex: 1 }}>{label}</ThemedText>
    </View>
  );
}

function StateBadge({ label, tone }: { label: string; tone: 'muted' | 'open' }) {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const color = tone === 'muted' ? colors.ink[500] : colors.teal[700];
  return (
    <View style={[styles.badge, { borderColor: color, backgroundColor: withAlpha(color, 0.12) }]}> 
      <ThemedText variant="label" color={color}>{label}</ThemedText>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
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
    backgroundColor: colors.glass.opaqueBg,
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
    backgroundColor: colors.glass.opaqueBg,
  },
  badgeRow: { flexWrap: 'wrap', gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: sawaaRadius.pill, borderWidth: 0.5 },
  ctaWrap: { position: 'absolute', start: 16, end: 16 },
  ctaPill: { padding: 6 },
});
