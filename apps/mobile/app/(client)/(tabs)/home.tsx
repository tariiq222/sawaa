import React, { useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AquaBackground } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { getPrimaryRole } from '@/types/auth';
import { getFontName } from '@/theme/fonts';
import { useHome, useMobileHomeCards, useClinics, useGroupSessions, usePackageFamilies, usePackagePurchases, usePublicCatalog, useTherapists } from '@/hooks/queries';
import { HomeSectionState } from '@/components/features/home/HomeSectionState';
import { HomeAssessmentServices } from '@/components/features/home/HomeAssessmentServices';
import { HomeCardsCarousel } from '@/components/features/home/HomeCardsCarousel';
import { FeaturedClinics } from '@/components/features/home/FeaturedClinics';
import { HomePackagesSlider } from '@/components/features/home/HomePackagesSlider';
import { HomeGroupsSlider } from '@/components/features/home/HomeGroupsSlider';
import { PackageBalanceCard } from '@/components/features/home/PackageBalanceCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HomeTopBar } from '@/components/features/home/HomeTopBar';
import { TherapistsRow } from '@/components/features/home/TherapistsRow';
import { UpNextCard } from '@/components/features/home/UpNextCard';
import { localeOf } from '@/lib/session-format';
import { isPortalBookingLive, nextPortalBooking, portalBookingEndInstant, portalBookingInstant } from '@/lib/portal-booking-time';
import { useReduceMotion } from '@/hooks/useA11y';
import { useClientEmailPrompt } from '@/hooks/useClientEmailPrompt';

const HOME_THERAPISTS_LIMIT = 6;

export default function HomeScreen() {
  const colors = useSawaaColors();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const router = useRouter();
  useClientEmailPrompt();
  const { token, user } = useAppSelector((s) => s.auth);
  const isClient = Boolean(token && user && getPrimaryRole(user) === 'client');
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const firstName = user?.firstName?.trim() ?? '';
  const today = new Date().toLocaleDateString(localeOf(dir.isRTL), {
    weekday: 'long', day: 'numeric', month: 'long', ...(dir.isRTL ? { calendar: 'gregory' } : {}),
  });

  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? t('home.greetingMorning') : t('home.greetingEvening');

  const homeQuery = useHome(isClient);
  const mobileHomeCardsQuery = useMobileHomeCards();
  const catalogQuery = usePublicCatalog();
  const therapistsQuery = useTherapists();
  const clinicsQuery = useClinics();
  const packageFamiliesQuery = usePackageFamilies();
  const groupsQuery = useGroupSessions();
  const packagePurchasesQuery = usePackagePurchases();
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now);
  const nextBooking = nextPortalBooking(homeQuery.data?.upcomingBookings ?? [], now);
  // Next time the card must change: the start while upcoming, the end while live.
  const nextBoundaryIso = nextBooking
    ? (isPortalBookingLive(nextBooking, now) ? portalBookingEndInstant(nextBooking) : portalBookingInstant(nextBooking))
    : null;
  const nextAt = nextBoundaryIso ? new Date(nextBoundaryIso).getTime() : null;
  const { refetch: refetchHome } = homeQuery;
  useFocusEffect(React.useCallback(() => {
    setNow(Date.now());
    if (isClient) void refetchHome();
  }, [isClient, refetchHome]));
  React.useEffect(() => {
    if (!isClient || nextAt === null) return;
    const timer = setTimeout(() => {
      setNow(Date.now());
      void refetchHome();
    }, Math.min(Math.max(nextAt - Date.now(), 1), 2_147_483_647));
    return () => clearTimeout(timer);
  }, [isClient, nextAt, refetchHome]);
  const loading = homeQuery.isLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        catalogQuery.refetch(),
        therapistsQuery.refetch(),
        clinicsQuery.refetch(),
        packageFamiliesQuery.refetch(),
        groupsQuery.refetch(),
        mobileHomeCardsQuery.refetch(),
        ...(isClient ? [homeQuery.refetch(), packagePurchasesQuery.refetch()] : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const therapistsHref: Href = isClient ? '/(client)/therapists' : '/public-list/therapists';
  const fade = (delay: number) => (reduceMotion ? undefined : FadeInDown.delay(delay).duration(450).easing(Easing.out(Easing.cubic)));

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: isClient ? 140 : insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal[600]} />}
      >
        <HomeTopBar
          f600={f600}
          isClient={isClient}
          dateLabel={today}
          greeting={firstName ? `${greeting}${dir.isRTL ? '،' : ','} ${firstName}` : greeting}
        />

        {isClient ? (
          <Animated.View entering={fade(60)}>
            <HomeSectionState loading={loading} error={homeQuery.isError} hasData={Boolean(homeQuery.data)} onRetry={() => { void homeQuery.refetch(); }}><UpNextCard loading={false} booking={nextBooking} now={now} dir={dir} f600={f600} f700={f700} /></HomeSectionState>
          </Animated.View>
        ) : null}

        <HomeSectionState loading={mobileHomeCardsQuery.isLoading} error={mobileHomeCardsQuery.isError} hasData={Boolean(mobileHomeCardsQuery.data?.length)} onRetry={() => { void mobileHomeCardsQuery.refetch(); }}><HomeCardsCarousel cards={mobileHomeCardsQuery.data ?? []} signedIn={isClient} /></HomeSectionState>
        {isClient ? <PackageBalanceCard /> : null}

        <HomeSectionState loading={therapistsQuery.isLoading} error={therapistsQuery.isError} hasData={Boolean(therapistsQuery.data?.length)} onRetry={() => { void therapistsQuery.refetch(); }}>
          <View style={styles.section}>
            <SectionHeader title={t('guest.therapists')} actionLabel={t('home.seeAllCount', { count: therapistsQuery.data?.length ?? 0 })} onActionPress={() => router.push(therapistsHref)} />
            <TherapistsRow therapists={(therapistsQuery.data ?? []).slice(0, HOME_THERAPISTS_LIMIT)} dir={dir} f400={f400} f600={f600} f700={f700} />
          </View>
        </HomeSectionState>

        <HomeSectionState loading={clinicsQuery.isLoading} error={clinicsQuery.isError} hasData={Boolean(clinicsQuery.data?.length)} onRetry={() => { void clinicsQuery.refetch(); }}>
          <View style={styles.section}>
            <SectionHeader title={t('clinics.title')} />
            <FeaturedClinics dir={dir} f600={f600} f700={f700} />
          </View>
        </HomeSectionState>

        <HomeSectionState loading={packageFamiliesQuery.isLoading} error={packageFamiliesQuery.isError} hasData={Boolean(packageFamiliesQuery.data?.length)} onRetry={() => { void packageFamiliesQuery.refetch(); }}>
          <View style={styles.section}>
            <SectionHeader title={t('packages.title')} />
            <HomePackagesSlider dir={dir} f400={f400} f700={f700} />
          </View>
        </HomeSectionState>

        <HomeSectionState loading={groupsQuery.isLoading} error={groupsQuery.isError} hasData={Boolean(groupsQuery.data?.length)} onRetry={() => { void groupsQuery.refetch(); }}>
          <View style={styles.section}>
            <SectionHeader title={t('groups.title')} />
            <HomeGroupsSlider dir={dir} f400={f400} f700={f700} />
          </View>
        </HomeSectionState>

        <HomeAssessmentServices />
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 20 },
  section: { gap: 12 },
});
