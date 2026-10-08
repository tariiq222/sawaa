import React, { useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Clock, Users, Wallet } from 'lucide-react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { FloatingCta } from '@/components/ui/FloatingCta';
import { InfoRows } from '@/components/ui/InfoRows';
import { Pill } from '@/components/ui/Pill';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useBookGroupSession, useGroupSession } from '@/hooks/queries';
import { resolveEnrollmentNextStep } from '@/services/client/group-sessions';
import { goBackOrHome } from '@/lib/navigation';
import { useDir } from '@/hooks/useDir';
import { formatHalalasPrice, formatWeekdayDateTime } from '@/lib/session-format';
import { getFontName } from '@/theme/fonts';
import { AquaBackground, PrimaryButton, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';

export default function GroupDetailScreen() {
  const colors = useSawaaColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const [footerHeight, setFooterHeight] = useState(180);
  const { t } = useTranslation();
  const groupQuery = useGroupSession(id);
  const book = useBookGroupSession();
  const group = groupQuery.data;

  const isClosed = Boolean(group?.isFull);
  // Keep the enrollment action available when a program is full: the server
  // can return an existing active enrollment for this client, which is the
  // recovery path for a previously reserved place.
  const ctaLabel = t('groups.registerInSession');
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

  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');
  const when = group ? formatWeekdayDateTime(group.scheduledAt, dir.isRTL) : null;

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: group ? footerHeight + sawaaSpacing.lg : insets.bottom + sawaaSpacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={t('groups.title')} onBack={() => goBackOrHome(router, '/(client)/(tabs)/home')} />

        {groupQuery.isLoading ? (
          <Skeleton height={180} radius={sawaaRadius.xl} />
        ) : groupQuery.isError || !group ? (
          <EmptyState
            icon="cloud-offline-outline"
            tone="danger"
            title={t('groups.bookError')}
            actionLabel={t('common.retry')}
            onAction={() => { void groupQuery.refetch(); }}
          />
        ) : (
          <>
            <Glass variant="strong" radius={sawaaRadius.xl} style={styles.hero}>
              <View style={[styles.heroTop, { flexDirection: dir.row }]}>
                <Text style={[styles.heroTitle, { color: colors.ink[900], fontFamily: f700, textAlign: dir.textAlign }]}>
                  {dir.isRTL ? group.nameAr : group.nameEn ?? group.nameAr}
                </Text>
                <Pill
                  tone={isClosed ? 'muted' : 'brand'}
                  label={isClosed ? t('groups.full') : t('groups.spotsLeft', { count: group.spotsLeft })}
                />
              </View>
              {description ? (
                <Text style={[styles.description, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>
                  {description}
                </Text>
              ) : null}
            </Glass>

            <InfoRows layout="stacked"
              rows={[
                { icon: CalendarDays, label: t('groups.dateLabel'), value: when ?? t('groups.dateTba') },
                { icon: Clock, label: t('groups.durationLabel'), value: t('groups.duration', { count: group.durationMins ?? 0 }) },
                { icon: Users, label: t('groups.enrolledLabel'), value: t('groups.enrolled', { count: group.enrolledCount, max: group.maxCapacity ?? group.maxParticipants }) },
                { icon: Wallet, label: t('groups.priceLabel'), value: formatHalalasPrice(group.price, dir.isRTL, t('home.sar')) },
              ]}
            />
          </>
        )}
      </ScrollView>

      {group ? (
        <FloatingCta onHeightChange={setFooterHeight}>
          <PrimaryButton label={ctaLabel} onPress={onJoin} disabled={book.isPending} loading={book.isPending} fontFamily={f700} />
        </FloatingCta>
      ) : null}
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.xl },
  hero: { padding: sawaaSpacing.lg, gap: sawaaSpacing.md },
  heroTop: { alignItems: 'flex-start', justifyContent: 'space-between', gap: sawaaSpacing.md },
  heroTitle: { flex: 1, fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  description: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
});
