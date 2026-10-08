import React, { useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AquaBackground } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { getPrimaryRole } from '@/types/auth';
import { getFontName } from '@/theme/fonts';
import { useHome, useMobileHomeCards, useClinics, usePublicCatalog, useTherapists } from '@/hooks/queries';
import { HomeSectionState } from '@/components/features/home/HomeSectionState';
import { HomeAssessmentServices } from '@/components/features/home/HomeAssessmentServices';
import { HomeDiscoveryCards } from '@/components/features/home/HomeDiscoveryCards';
import { HomeCardsCarousel } from '@/components/features/home/HomeCardsCarousel';
import { FeaturedClinics } from '@/components/features/home/FeaturedClinics';
import { PackageBalanceCard } from '@/components/features/home/PackageBalanceCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HomeTopBar } from '@/components/features/home/HomeTopBar';
import { TherapistsRow } from '@/components/features/home/TherapistsRow';
import { UpNextCard } from '@/components/features/home/UpNextCard';
import { useReduceMotion } from '@/hooks/useA11y';

export default function HomeScreen() {
  const colors = useSawaaColors();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const router = useRouter();
  const { token, user } = useAppSelector((s) => s.auth);
  const isClient = Boolean(token && user && getPrimaryRole(user) === 'client');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const firstName = user?.firstName?.trim() ?? '';
  const today = new Date().toLocaleDateString(dir.isRTL ? 'ar-SA' : 'en-US', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? t('home.greetingMorning')
    : hour >= 12 && hour < 17 ? t('home.greetingAfternoon')
      : hour >= 17 && hour <= 23 ? t('home.greetingEvening') : t('home.greetingNight');

  const homeQuery = useHome(isClient);
  const mobileHomeCardsQuery = useMobileHomeCards();
  const catalogQuery = usePublicCatalog();
  const therapistsQuery = useTherapists();
  const clinicsQuery = useClinics();
  const [refreshing, setRefreshing] = useState(false);
  const nextBooking = homeQuery.data?.upcomingBookings?.[0] ?? null;
  const loading = homeQuery.isLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        catalogQuery.refetch(),
        therapistsQuery.refetch(),
        clinicsQuery.refetch(),
        mobileHomeCardsQuery.refetch(),
        ...(isClient ? [homeQuery.refetch()] : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const therapistsHref: Href = isClient ? '/(client)/therapists' : '/public-list/therapists';
  const clinicsHref: Href = isClient ? '/(client)/clinics' : '/public-list/clinics';
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
            <HomeSectionState loading={loading} error={homeQuery.isError} hasData={Boolean(nextBooking)} onRetry={() => { void homeQuery.refetch(); }}><UpNextCard loading={false} booking={nextBooking} dir={dir} f600={f600} f700={f700} /></HomeSectionState>
          </Animated.View>
        ) : null}

        <HomeSectionState loading={mobileHomeCardsQuery.isLoading} error={mobileHomeCardsQuery.isError} hasData={Boolean(mobileHomeCardsQuery.data?.length)} onRetry={() => { void mobileHomeCardsQuery.refetch(); }}><HomeCardsCarousel cards={mobileHomeCardsQuery.data ?? []} signedIn={isClient} /></HomeSectionState>
        {isClient ? <PackageBalanceCard /> : null}

        <View style={styles.section}>
          <SectionHeader title={t(isClient ? 'home.chooseHere' : 'home.introTitle')} />
          <HomeDiscoveryCards signedIn={isClient} />
        </View>

        <HomeSectionState loading={therapistsQuery.isLoading} error={therapistsQuery.isError} hasData={Boolean(therapistsQuery.data?.length)} onRetry={() => { void therapistsQuery.refetch(); }}>
          <View style={styles.section}>
            <SectionHeader title={t('guest.therapists')} actionLabel={t('home.seeAll')} onActionPress={() => router.push(therapistsHref)} />
            <TherapistsRow therapists={therapistsQuery.data ?? []} dir={dir} f400={getFontName(dir.locale, '400')} f600={f600} f700={f700} />
          </View>
        </HomeSectionState>

        <HomeSectionState loading={clinicsQuery.isLoading} error={clinicsQuery.isError} hasData={Boolean(clinicsQuery.data?.length)} onRetry={() => { void clinicsQuery.refetch(); }}>
          <View style={styles.section}>
            <SectionHeader title={t('clinics.title')} actionLabel={t('home.seeAll')} onActionPress={() => router.push(clinicsHref)} />
            <FeaturedClinics dir={dir} f600={f600} f700={f700} />
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
