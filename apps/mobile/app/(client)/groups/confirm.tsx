import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { CalendarDays, CalendarRange, Clock, Users, Wallet } from 'lucide-react-native';

import { BookingStepHeader } from '@/components/features/booking/BookingStepHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { FloatingCta } from '@/components/ui/FloatingCta';
import { InfoRows, type InfoRow } from '@/components/ui/InfoRows';
import { Skeleton } from '@/components/ui/Skeleton';
import { GROUP_FLOW_STEPS } from '@/features/groups/group-flow';
import { useBookGroupSession, useGroupSession } from '@/hooks/queries';
import { useAppSelector } from '@/hooks/use-redux';
import { useDir } from '@/hooks/useDir';
import { goBackOrHome, loginRedirectHref } from '@/lib/navigation';
import { formatHalalasPrice, formatWeekdayDateTime } from '@/lib/session-format';
import { resolveEnrollmentNextStep } from '@/services/client/group-sessions';
import { getFontName } from '@/theme/fonts';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { AquaBackground, sawaaRadius, sawaaSpacing } from '@/theme/sawaa';

/**
 * Step 2 of the support-group flow (client route; guests open the public
 * re-export). Guests sign in here and return to this same step afterwards.
 */
export default function GroupConfirmScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const [footerHeight, setFooterHeight] = useState(180);
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const groupQuery = useGroupSession(id);
  const book = useBookGroupSession();
  const group = groupQuery.data;
  const f700 = getFontName(dir.locale, '700');

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
          Alert.alert(t('groups.title'), t('groups.booked'), [
            { text: t('common.ok'), onPress: () => router.replace('/(client)/(tabs)/appointments') },
          ]);
          return;
        }
        Alert.alert(t('groups.title'), t('groups.invoiceMissing'));
      },
      onError: () => Alert.alert(t('groups.title'), t('groups.bookError')),
    });
  };

  const signIn = () => {
    router.push(loginRedirectHref(['(client)', 'groups', 'confirm'], { id }));
  };

  const rows: (InfoRow | null)[] = [];
  if (group) {
    const number = (value: number) => new Intl.NumberFormat(dir.isRTL ? 'ar-SA' : 'en-US').format(value);
    const when = formatWeekdayDateTime(group.scheduledAt ?? group.startDate, dir.isRTL);
    rows.push(
      { icon: Users, label: t('groups.nameLabel'), value: dir.isRTL ? group.nameAr : group.nameEn ?? group.nameAr },
      { icon: CalendarDays, label: t('groups.dateLabel'), value: when ?? t('groups.dateTba') },
      group.daysCount > 0 ? { icon: CalendarRange, label: t('groups.daysLabel'), value: number(group.daysCount) } : null,
      group.hoursPerDay > 0 ? { icon: Clock, label: t('groups.hoursPerDayLabel'), value: number(group.hoursPerDay) } : null,
      { icon: Wallet, label: t('groups.priceLabel'), value: formatHalalasPrice(group.price, dir.isRTL, t('home.sar')) },
      group.depositEnabled && group.depositAmount
        ? { icon: Wallet, label: t('groups.depositLabel'), value: formatHalalasPrice(group.depositAmount, dir.isRTL, t('home.sar')) }
        : null,
    );
  }

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: group ? footerHeight + sawaaSpacing.lg : insets.bottom + sawaaSpacing.lg }]}
        showsVerticalScrollIndicator={false}
      >
        <BookingStepHeader
          step={2}
          total={GROUP_FLOW_STEPS}
          title={t('groups.confirmTitle')}
          onBack={() => (signedIn ? goBackOrHome(router, '/(client)/(tabs)/home') : goBackOrHome(router))}
        />
        {groupQuery.isLoading ? (
          <Skeleton height={180} radius={sawaaRadius.xl} />
        ) : groupQuery.isError || !group ? (
          <EmptyState
            icon="cloud-offline-outline"
            tone="danger"
            title={t('groups.loadError')}
            actionLabel={t('common.retry')}
            onAction={() => { void groupQuery.refetch(); }}
          />
        ) : (
          <InfoRows layout="stacked" rows={rows.filter((row): row is InfoRow => row !== null)} />
        )}
      </ScrollView>

      {group ? (
        <FloatingCta onHeightChange={setFooterHeight}>
          {signedIn ? (
            <PrimaryButton label={t('groups.registerInSession')} onPress={onJoin} disabled={book.isPending || group.isFull} loading={book.isPending} fontFamily={f700} />
          ) : (
            <PrimaryButton label={t('booking.signInOrRegisterToContinue')} onPress={signIn} disabled={group.isFull} fontFamily={f700} />
          )}
        </FloatingCta>
      ) : null}
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.xl },
});
