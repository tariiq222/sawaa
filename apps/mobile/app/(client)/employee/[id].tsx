import React, { useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { ChevronLeft, ChevronRight, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AquaBackground, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { formatHalalas } from '@/lib/money';
import { useTherapist } from '@/hooks/queries';
import { publicCatalogService } from '@/services/client/catalog';
import { PractitionerBookingAction } from '@/components/features/PractitionerBookingAction';

const createSpecialties = (colors: ReturnType<typeof useSawaaColors>) => [
  { ar: 'القلق العام', en: 'General Anxiety', color: colors.teal[600] },
  { ar: 'نوبات الهلع', en: 'Panic', color: colors.accent.violet },
  { ar: 'الاكتئاب', en: 'Depression', color: colors.accent.rose },
  { ar: 'الوسواس', en: 'OCD', color: colors.accent.amber },
  { ar: 'الرهاب الاجتماعي', en: 'Social phobia', color: colors.accent.sky },
];

const REVIEWS = [
  {
    byAr: 'نورة', byEn: 'Noura',
    whenAr: 'قبل أسبوع', whenEn: '1 week ago',
    textAr: '"جلسات عميقة ومهنية، شعرت بفرق حقيقي بعد ٤ جلسات فقط."',
    textEn: '"Deep, professional sessions. Felt a real difference after only 4 sessions."',
  },
];

export default function EmployeeProfileScreen() {
  const colors = useSawaaColors();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(colors, theme.colors), [colors, theme.colors]);
  const specialties = useMemo(() => createSpecialties(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const { data: employee } = useTherapist(id);
  const { data: catalog, isLoading: catalogLoading, isError: catalogError, refetch: refetchCatalog } = useQuery({
    queryKey: ['publicCatalog'],
    queryFn: () => publicCatalogService.getCatalog(),
  });

  const employeeName = employee
    ? (dir.isRTL ? employee.nameAr : employee.nameEn) ?? employee.nameEn ?? employee.nameAr ?? '—'
    : '—';
  const employeeSpec = employee
    ? [
        (dir.isRTL ? employee.specialtyAr : employee.specialty) ?? employee.specialty ?? employee.specialtyAr ?? '',
        employee.title ?? '',
      ].filter(Boolean).join(' · ')
    : '';
  const employeeBio = employee
    ? (dir.isRTL ? employee.publicBioAr : employee.publicBioEn) ?? employee.publicBioEn ?? employee.publicBioAr ?? ''
    : '';

  const stats = [
    { nAr: '١٢', nEn: '12', ar: 'سنة خبرة', en: 'yrs exp' },
    { nAr: '٩٨٠', nEn: '980', ar: 'جلسة', en: 'Sessions' },
    { nAr: '٩٨٪', nEn: '98%', ar: 'رضا', en: 'Satisfaction' },
  ];

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(500)}>
          <Glass
            variant="strong"
            radius={22}
            onPress={() => router.back()}
            interactive
            accessibilityLabel={t('a11y.buttonBack')}
            style={styles.backBtn}
          >
            <BackIcon size={22} color={colors.ink[700]} strokeWidth={1.75} />
          </Glass>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.heroCard}>
            <View style={[styles.heroRow, { flexDirection: dir.row }]}>
              <LinearGradient
                colors={theme.colors.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={[styles.avatarText, { fontFamily: f700 }]}>{employeeName.charAt(0)}</Text>
                <View style={styles.onlineDot} />
              </LinearGradient>
              <View style={styles.heroMid}>
                <Text style={[styles.heroName, { fontFamily: f700, textAlign: dir.textAlign }]}>
                  {employeeName}
                </Text>
                <Text style={[styles.heroSpec, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
                  {employeeSpec}
                </Text>
                <View style={[styles.rating, { flexDirection: dir.row }]}>
                  <Star size={11} color={colors.accent.amber} strokeWidth={2} fill={colors.accent.amber} />
                  <Text style={[styles.ratingVal, { fontFamily: f700 }]}>4.9</Text>
                  <Text style={[styles.ratingCount, { fontFamily: f400, fontWeight: '400' }]}>
                    {dir.isRTL ? '(٤١٢ تقييم)' : '(412 reviews)'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={[styles.statsRow, { flexDirection: dir.row }]}>
              {stats.map((s) => (
                <View key={s.en} style={styles.statBox}>
                  <Text style={[styles.statN, { fontFamily: f700 }]}>
                    {dir.isRTL ? s.nAr : s.nEn}
                  </Text>
                  <Text style={[styles.statL, { fontFamily: f400, fontWeight: '400' }]}>
                    {dir.isRTL ? s.ar : s.en}
                  </Text>
                </View>
              ))}
            </View>
          </Glass>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(180).duration(700).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'نبذة' : 'About'}
          </Text>
          <Text style={[styles.aboutText, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
            {employeeBio || (dir.isRTL ? '—' : '—')}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).duration(700).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'التخصصات' : 'Expertise'}
          </Text>
          <View style={[styles.tagRow, { flexDirection: dir.row }]}>
            {specialties.map((s) => (
              <View
                key={s.en}
                style={[
                  styles.tag,
                  { backgroundColor: `${s.color}1e`, borderColor: `${s.color}33` },
                ]}
              >
                <Text style={[styles.tagText, { fontFamily: f600, fontWeight: '600', color: s.color }]}>
                  {dir.isRTL ? s.ar : s.en}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(340).duration(700).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'آراء العملاء' : 'Reviews'}
          </Text>
          {REVIEWS.map((r) => (
            <Glass key={r.byEn} variant="strong" radius={sawaaRadius.xl} style={styles.reviewCard}>
              <View style={[styles.reviewHead, { flexDirection: dir.row }]}>
                <View style={[styles.stars, { flexDirection: dir.row }]}>
                  {[0, 1, 2, 3, 4].map((k) => (
                    <Star key={k} size={12} color={colors.accent.amber} strokeWidth={2} fill={colors.accent.amber} />
                  ))}
                </View>
                <Text style={[styles.reviewBy, { fontFamily: f700 }]}>
                  {dir.isRTL ? `${r.byAr} · ${r.whenAr}` : `${r.byEn} · ${r.whenEn}`}
                </Text>
              </View>
              <Text style={[styles.reviewText, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
                {dir.isRTL ? r.textAr : r.textEn}
              </Text>
            </Glass>
          ))}
        </Animated.View>
      </ScrollView>

      <Animated.View
        entering={FadeInDown.delay(420).duration(800).easing(Easing.out(Easing.cubic))}
        style={[styles.ctaWrap, { bottom: insets.bottom + 20 }]}
      >
        <Glass variant="strong" radius={sawaaRadius.pill} style={styles.ctaPill}>
          <View style={[styles.ctaRow, { flexDirection: dir.row }]}>
            <View style={styles.ctaPrice}>
              <Text style={[styles.ctaPriceLabel, { fontFamily: f400, fontWeight: '400' }]}>
                {dir.isRTL ? 'السعر لكل جلسة' : 'Per session'}
              </Text>
              <Text style={[styles.ctaPriceVal, { fontFamily: f700 }]}>
                {`${formatHalalas(employee?.minServicePrice ?? 0, { locale: dir.isRTL ? 'ar-SA' : 'en-US' })} ﷼`}
              </Text>
            </View>
            {catalogLoading ? (
              <ActivityIndicator color={colors.teal[700]} />
            ) : catalogError ? (
              <Pressable onPress={() => refetchCatalog()} style={styles.ctaBtnPress} accessibilityRole="button">
                <Text style={[styles.ctaBtnText, { fontFamily: f700 }]}>{t('common.retry')}</Text>
              </Pressable>
            ) : employee ? (
              <PractitionerBookingAction
                employee={employee}
                catalogServices={catalog?.services ?? []}
                t={(key, options) => t(key, options)}
                onNavigate={(route) => router.push(route)}
              />
            ) : null}
          </View>
        </Glass>
      </Animated.View>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>, themeColors: ReturnType<typeof useTheme>['theme']['colors']) => StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 18 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  heroCard: { padding: 18 },
  heroRow: { alignItems: 'center', gap: 14 },
  avatar: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
    shadowColor: themeColors.primaryFill, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
  },
  avatarText: { fontSize: 32, color: themeColors.primaryForeground },
  onlineDot: {
    position: 'absolute', bottom: 4, right: 4,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: colors.teal[500], borderWidth: 2, borderColor: colors.glass.opaqueBg,
  },
  heroMid: { flex: 1 },
  heroName: { fontSize: 17, color: colors.ink[900] },
  heroSpec: { fontSize: 12, color: colors.ink[500], marginTop: 2 },
  rating: { alignItems: 'center', gap: 4, marginTop: 6 },
  ratingVal: { fontSize: 11, color: colors.ink[900] },
  ratingCount: { fontSize: 11, color: colors.ink[500] },
  statsRow: { marginTop: 14, gap: 8 },
  statBox: {
    flex: 1, paddingVertical: 10, borderRadius: 14,
    backgroundColor: colors.glass.bg,
    borderWidth: 0.5, borderColor: colors.glass.border,
    alignItems: 'center',
  },
  statN: { fontSize: 15, color: colors.teal[700] },
  statL: { fontSize: 10, color: colors.ink[500], marginTop: 2 },
  sectionTitle: { fontSize: 14, color: colors.ink[900], marginBottom: 8 },
  aboutText: { fontSize: 12.5, color: colors.ink[700], lineHeight: 22 },
  tagRow: { flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12,
    borderWidth: 0.5,
  },
  tagText: { fontSize: 11 },
  reviewCard: { padding: 14 },
  reviewHead: { justifyContent: 'space-between', alignItems: 'center' },
  stars: { gap: 2 },
  reviewBy: { fontSize: 12.5, color: colors.ink[900] },
  reviewText: { fontSize: 12, color: colors.ink[700], marginTop: 6, lineHeight: 20 },
  ctaWrap: { position: 'absolute', left: 16, right: 16 },
  ctaPill: { padding: 6 },
  ctaRow: { alignItems: 'center', gap: 8, height: 46 },
  ctaPrice: { flex: 1, paddingHorizontal: 12 },
  ctaPriceLabel: { fontSize: 10, color: colors.ink[500] },
  ctaPriceVal: { fontSize: 13, color: colors.teal[700], marginTop: 2 },
  ctaBtnPress: { height: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, borderRadius: 999, backgroundColor: themeColors.primaryFill },
  ctaBtnText: { color: themeColors.primaryForeground, fontSize: 13 },
});
