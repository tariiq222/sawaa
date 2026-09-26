import React, { useMemo, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronLeft, ChevronRight, Grid2X2, Package, Users, UsersRound } from 'lucide-react-native';

import { AquaBackground } from '@/theme/sawaa';
import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { getFontName } from '@/theme/fonts';
import { useHome, useTherapists, usePublicCatalog, useClinics, useGroupSessions } from '@/hooks/queries';
import { HomeTopBar } from '@/components/features/home/HomeTopBar';
import { UpNextCard } from '@/components/features/home/UpNextCard';
import { FeaturedClinics } from '@/components/features/home/FeaturedClinics';
import { SupportSessions } from '@/components/features/home/SupportSessions';
import { TherapistsRow } from '@/components/features/home/TherapistsRow';
import { ServiceThumbnail } from '@/components/features/home/ServiceThumbnail';
import { GuestDock, GuestDiscoveryGrid } from '@/components/features/home/GuestDock';
import { HomeSectionHeading } from '@/components/features/home/HomeSectionHeading';
import { AppIcon } from '@/components/ui/AppIcon';
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
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const firstName = user?.firstName?.trim() ?? '';
  const today = new Date().toLocaleDateString(dir.isRTL ? 'ar-SA' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const getGreeting = (hour: number) => {
    if (hour >= 5 && hour < 12) return t('home.greetingMorning');
    if (hour >= 12 && hour < 17) return t('home.greetingAfternoon');
    if (hour >= 17 && hour <= 23) return t('home.greetingEvening');
    return t('home.greetingNight');
  };
  const greeting = getGreeting(new Date().getHours());

  const homeQuery = useHome(isClient);
  const catalogQuery = usePublicCatalog();
  const therapistsQuery = useTherapists();
  const clinicsQuery = useClinics();
  const groupsQuery = useGroupSessions();
  const [refreshing, setRefreshing] = useState(false);

  const nextBooking = homeQuery.data?.upcomingBookings?.[0] ?? null;
  const unreadCount = homeQuery.data?.unreadNotifications?.length ?? 0;
  const therapists = (therapistsQuery.data ?? []).slice(0, 6);
  const services = (catalogQuery.data?.services ?? []).slice(0, 6);
  const hasUpcomingGroups = (groupsQuery.data ?? []).some((group) => group.scheduledAt && new Date(group.scheduledAt).getTime() >= Date.now());
  const loading = homeQuery.isLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        ...(isClient ? [homeQuery.refetch()] : []),
        catalogQuery.refetch(),
        therapistsQuery.refetch(),
        clinicsQuery.refetch(),
        groupsQuery.refetch(),
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.teal[600]}
          />
        }
      >
        <HomeTopBar f600={f600} isClient={isClient} />

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))} style={styles.hero}>
          <View style={styles.greetingBlock}>
            <Text style={[styles.dateLabel, { fontFamily: f600, fontWeight: '600', textAlign: dir.textAlign }]}>{today}</Text>
            <Text style={[styles.greeting, { fontFamily: f700, textAlign: dir.textAlign }]}>
              {firstName ? `${greeting}${dir.isRTL ? '،' : ','} ${firstName}` : greeting}
            </Text>
          </View>
        </Animated.View>

        {!isClient ? <GuestDiscoveryGrid /> : null}

        {isClient && (loading || nextBooking) ? (
          <>
            <Animated.View
              entering={reduceMotion ? undefined : FadeInDown.delay(220).duration(700).easing(Easing.out(Easing.cubic))}
              style={[styles.sectionHead, { flexDirection: dir.row }]}
            >
              <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
                {dir.isRTL ? 'القادم' : 'Up next'}
              </Text>
              {unreadCount > 0 ? (
                <Pressable onPress={() => router.push('/(client)/notifications')}>
                  <Text style={[styles.sectionMeta, { fontFamily: f600, fontWeight: '600', color: colors.teal[700] }]}>
                    {dir.isRTL
                      ? `${unreadCount.toLocaleString('ar-SA')} تنبيه جديد`
                      : `${unreadCount} new alert${unreadCount === 1 ? '' : 's'}`}
                  </Text>
                </Pressable>
              ) : null}
            </Animated.View>

            <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(300).duration(700).easing(Easing.out(Easing.cubic))}>
              <UpNextCard loading={loading} booking={nextBooking} dir={dir} f600={f600} f700={f700} />
            </Animated.View>
          </>
        ) : null}

        {(clinicsQuery.data?.length ?? 0) > 0 ? (
          <>
            <HomeSectionHeading title={t('clinics.title')} symbol="building.2.fill" icon={Building2}
              onSeeAll={() => router.push(isClient ? '/(client)/clinics' : '/public-list/clinics')} />
            <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(440).duration(700).easing(Easing.out(Easing.cubic))}>
              <FeaturedClinics dir={dir} f600={f600} f700={f700} isClient={isClient} />
            </Animated.View>
          </>
        ) : null}

        {services.length > 0 ? <HomeSectionHeading title={t('guest.services')} symbol="square.grid.2x2.fill" icon={Grid2X2} /> : null}
        {services.map((service) => (
          <Pressable key={service.id} style={styles.packageSurface}
            onPress={() => router.push({ pathname: '/public-detail/[kind]/[id]', params: { kind: 'service', id: service.id } })}
            accessibilityRole="button"
            accessibilityLabel={dir.isRTL ? service.nameAr : service.nameEn ?? service.nameAr}>
            <View style={[styles.packageEntry, { flexDirection: dir.row }]}>
              <ServiceThumbnail name={dir.isRTL ? service.nameAr : service.nameEn ?? service.nameAr} imageUrl={service.imageUrl} />
              <Text style={[styles.packageEntryTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
                {dir.isRTL ? service.nameAr : service.nameEn ?? service.nameAr}
              </Text>
              <AppIcon sf={dir.isRTL ? 'chevron.left' : 'chevron.right'} fallback={dir.isRTL ? ChevronLeft : ChevronRight} size={19} color={colors.teal[700]} />
            </View>
          </Pressable>
        ))}

        {isClient ? (
          <Pressable style={styles.packageSurface} onPress={() => router.push('/(client)/packages')} accessibilityRole="button">
            <View style={[styles.packageEntry, { flexDirection: dir.row }]}>
              <AppIcon sf="shippingbox.fill" fallback={Package} size={22} color={colors.teal[700]} />
              <Text style={[styles.packageEntryTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>{t('packages.homeEntry')}</Text>
              <AppIcon sf={dir.isRTL ? 'chevron.left' : 'chevron.right'} fallback={dir.isRTL ? ChevronLeft : ChevronRight} size={19} color={colors.teal[700]} />
            </View>
          </Pressable>
        ) : null}

        {hasUpcomingGroups ? (
          <>
            <HomeSectionHeading title={t('groups.title')} symbol="person.3.fill" icon={Users}
              onSeeAll={() => router.push(isClient ? '/(client)/groups' : '/public-list/programs')} />
            <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(580).duration(700).easing(Easing.out(Easing.cubic))}>
              <SupportSessions dir={dir} f400={f400} f700={f700} isClient={isClient} />
            </Animated.View>
          </>
        ) : null}

        {therapists.length > 0 || isClient ? (
          <>
            <HomeSectionHeading title={t('home.featured')} symbol="person.2.fill" icon={UsersRound}
              onSeeAll={() => router.push(isClient ? '/(client)/therapists' : '/public-list/therapists')} />
            <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(700).duration(800).easing(Easing.out(Easing.cubic))}>
              <TherapistsRow therapists={therapists} dir={dir} f400={f400} f600={f600} f700={f700} isClient={isClient} />
            </Animated.View>
          </>
        ) : null}
      </ScrollView>
      {!isClient ? <GuestDock active="home" /> : null}
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 16 },
  hero: { minHeight: 88 },
  greetingBlock: { paddingHorizontal: 20, paddingVertical: 20 },
  dateLabel: { fontSize: 12, color: colors.teal[700], opacity: 0.75 },
  greeting: { fontSize: 26, lineHeight: 34, color: colors.ink[900], marginTop: 2 },
  sectionHead: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    marginTop: 4,
  },
  sectionTitle: { fontSize: 16, color: colors.ink[900] },
  sectionMeta: { fontSize: 12 },
  packageEntry: { alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 18 },
  packageSurface: { backgroundColor: colors.glass.opaqueBg, borderRadius: 20, overflow: 'hidden' },
  packageEntryTitle: { flex: 1, color: colors.ink[900], fontSize: 16 },
});
