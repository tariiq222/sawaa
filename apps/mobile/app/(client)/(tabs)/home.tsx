import React, { useMemo, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AquaBackground } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { getFontName } from '@/theme/fonts';
import { useHome, useTherapists } from '@/hooks/queries';
import { HomeTopBar } from '@/components/features/home/HomeTopBar';
import { UpNextCard } from '@/components/features/home/UpNextCard';
import { FeaturedClinics } from '@/components/features/home/FeaturedClinics';
import { SupportSessions } from '@/components/features/home/SupportSessions';
import { TherapistsRow } from '@/components/features/home/TherapistsRow';
import { useReduceMotion } from '@/hooks/useA11y';

export default function HomeScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
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

  const homeQuery = useHome();
  const therapistsQuery = useTherapists();
  const [refreshing, setRefreshing] = useState(false);

  const nextBooking = homeQuery.data?.upcomingBookings?.[0] ?? null;
  const unreadCount = homeQuery.data?.unreadNotifications?.length ?? 0;
  const therapists = (therapistsQuery.data ?? []).slice(0, 6);
  const loading = homeQuery.isLoading;

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([homeQuery.refetch(), therapistsQuery.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.teal[600]}
          />
        }
      >
        <HomeTopBar f600={f600} />

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}
          style={styles.greetingBlock}
        >
          <Text style={[styles.dateLabel, { fontFamily: f600, fontWeight: '600', textAlign: dir.textAlign }]}>
            {today}
          </Text>
          <Text style={[styles.greeting, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {firstName ? `${greeting}${dir.isRTL ? '،' : ','} ${firstName}` : greeting}
          </Text>
        </Animated.View>

        {(loading || nextBooking) ? (
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

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(380).duration(700).easing(Easing.out(Easing.cubic))}
          style={[styles.sectionHead, { flexDirection: dir.row }]}
        >
          <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
            {t('clinics.title')}
          </Text>
          <Pressable onPress={() => router.push('/(client)/clinics')} accessibilityRole="button">
            <Text style={[styles.sectionMeta, { fontFamily: f600, fontWeight: '600', color: colors.teal[700] }]}>
              {t('home.seeAll')}
            </Text>
          </Pressable>
        </Animated.View>
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(440).duration(700).easing(Easing.out(Easing.cubic))}>
          <FeaturedClinics dir={dir} f600={f600} f700={f700} />
        </Animated.View>

        <Glass variant="strong" radius={20} onPress={() => router.push('/(client)/packages')} interactive>
          <View style={[styles.packageEntry, { flexDirection: dir.row }]}>
            <Text style={[styles.packageEntryTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>{t('packages.homeEntry')}</Text>
            <Text style={[styles.packageEntryAction, { fontFamily: f600 }]}>{t('home.seeAll')}</Text>
          </View>
        </Glass>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(520).duration(700).easing(Easing.out(Easing.cubic))}
          style={[styles.sectionHead, { flexDirection: dir.row }]}
        >
          <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
            {t('groups.title')}
          </Text>
          <Pressable onPress={() => router.push('/(client)/groups')} accessibilityRole="button">
            <Text style={[styles.sectionMeta, { fontFamily: f600, fontWeight: '600', color: colors.teal[700] }]}>
              {t('groups.seeAll')}
            </Text>
          </Pressable>
        </Animated.View>
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(580).duration(700).easing(Easing.out(Easing.cubic))}>
          <SupportSessions dir={dir} f400={f400} f700={f700} />
        </Animated.View>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(640).duration(700).easing(Easing.out(Easing.cubic))}
          style={[styles.sectionHead, { flexDirection: dir.row }]}
        >
          <Text style={[styles.sectionTitle, { fontFamily: f700 }]}>
            {t('home.featured')}
          </Text>
        </Animated.View>
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(700).duration(800).easing(Easing.out(Easing.cubic))}>
          <TherapistsRow therapists={therapists} dir={dir} f400={f400} f600={f600} f700={f700} />
        </Animated.View>
      </ScrollView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 16 },
  greetingBlock: { paddingHorizontal: 4, marginTop: 4 },
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
  packageEntry: { alignItems: 'center', justifyContent: 'space-between', padding: 18 },
  packageEntryTitle: { flex: 1, color: colors.ink[900], fontSize: 16 },
  packageEntryAction: { color: colors.teal[700], fontSize: 12 },
});
