import React, { useMemo, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AquaBackground } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { getFontName } from '@/theme/fonts';
import { useHome, useMobileHomeCards, usePublicCatalog, useTherapists } from '@/hooks/queries';
import { HomeAssessmentServices } from '@/components/features/home/HomeAssessmentServices';
import { HomeDiscoveryCards } from '@/components/features/home/HomeDiscoveryCards';
import { HomeCardsCarousel } from '@/components/features/home/HomeCardsCarousel';
import { HomeTopBar } from '@/components/features/home/HomeTopBar';
import { TherapistsRow } from '@/components/features/home/TherapistsRow';
import { UpNextCard } from '@/components/features/home/UpNextCard';
import { GuestDock } from '@/components/features/home/GuestDock';
import { useReduceMotion } from '@/hooks/useA11y';

export default function HomeScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const router = useRouter();
  const { token, user } = useAppSelector((s) => s.auth);
  const isClient = Boolean(token && user);
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
  const [refreshing, setRefreshing] = useState(false);
  const nextBooking = homeQuery.data?.upcomingBookings?.[0] ?? null;
  const unreadCount = homeQuery.data?.unreadNotifications?.length ?? 0;
  const loading = homeQuery.isLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        catalogQuery.refetch(),
        therapistsQuery.refetch(),
        mobileHomeCardsQuery.refetch(),
        ...(isClient ? [homeQuery.refetch()] : []),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: isClient ? 140 : insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal[600]} />}
      >
        <HomeTopBar f600={f600} isClient={isClient} />
        <HomeCardsCarousel cards={mobileHomeCardsQuery.data ?? []} signedIn={isClient} />

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(500).easing(Easing.out(Easing.cubic))} style={styles.hero}>
          <Text style={[styles.dateLabel, { fontFamily: f600, textAlign: dir.textAlign }]}>{today}</Text>
          <Text style={[styles.greeting, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {firstName ? `${greeting}${dir.isRTL ? '،' : ','} ${firstName}` : greeting}
          </Text>
        </Animated.View>

        {isClient && (loading || nextBooking) ? (
          <View>
            <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(120).duration(450)} style={[styles.sectionHead, { flexDirection: dir.row }]}>
              <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>{t('home.upcomingAppointment')}</Text>
              {unreadCount > 0 ? (
                <Text onPress={() => router.push('/(client)/notifications')} style={[styles.sectionMeta, { fontFamily: f600, color: colors.teal[700] }]}>
                  {dir.isRTL ? `${unreadCount.toLocaleString('ar-SA')} تنبيه جديد` : `${unreadCount} new alert${unreadCount === 1 ? '' : 's'}`}
                </Text>
              ) : null}
            </Animated.View>
            <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(180).duration(500)}>
              <UpNextCard loading={loading} booking={nextBooking} dir={dir} f600={f600} f700={f700} />
            </Animated.View>
          </View>
        ) : null}

        <HomeDiscoveryCards signedIn={isClient} />
        <HomeAssessmentServices />
        {(therapistsQuery.data?.length ?? 0) > 0 ? (
          <View style={styles.therapistsSection}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>{t('guest.therapists')}</Text>
            <TherapistsRow therapists={therapistsQuery.data ?? []} dir={dir} f400={getFontName(dir.locale, '400')} f600={f600} f700={f700} />
          </View>
        ) : null}
      </ScrollView>
      {!isClient ? <GuestDock active="home" /> : null}
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  therapistsSection: { gap: 12, marginTop: 12 },
  scroll: { paddingHorizontal: 16, gap: 12 },
  hero: { paddingHorizontal: 12, paddingVertical: 10 },
  dateLabel: { fontSize: 12, color: colors.teal[700], opacity: 0.75 },
  greeting: { fontSize: 24, lineHeight: 31, color: colors.ink[900], marginTop: 2 },
  sectionHead: { justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4, marginBottom: 8 },
  sectionTitle: { fontSize: 16, color: colors.ink[900] },
  sectionMeta: { fontSize: 12 },
});
