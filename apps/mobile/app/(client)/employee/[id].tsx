import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react-native';

import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useTherapist } from '@/hooks/queries';

const SPECIALTIES = [
  { ar: 'القلق العام', en: 'General Anxiety', color: sawaaColors.teal[600] },
  { ar: 'نوبات الهلع', en: 'Panic', color: sawaaColors.accent.violet },
  { ar: 'الاكتئاب', en: 'Depression', color: sawaaColors.accent.rose },
  { ar: 'الوسواس', en: 'OCD', color: sawaaColors.accent.amber },
  { ar: 'الرهاب الاجتماعي', en: 'Social phobia', color: sawaaColors.accent.sky },
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;
  const { data: employee } = useTherapist(id);

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
            style={styles.backBtn}
          >
            <BackIcon size={22} color={sawaaColors.ink[700]} strokeWidth={1.75} />
          </Glass>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.heroCard}>
            <View style={[styles.heroRow, { flexDirection: dir.row }]}>
              <LinearGradient
                colors={['#f7cbb7', '#e88f6c']}
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
                <Text style={[styles.heroSpec, { fontFamily: f400, textAlign: dir.textAlign }]}>
                  {employeeSpec}
                </Text>
                <View style={[styles.rating, { flexDirection: dir.row }]}>
                  <Star size={11} color={sawaaColors.accent.amber} strokeWidth={2} fill={sawaaColors.accent.amber} />
                  <Text style={[styles.ratingVal, { fontFamily: f700 }]}>4.9</Text>
                  <Text style={[styles.ratingCount, { fontFamily: f400 }]}>
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
                  <Text style={[styles.statL, { fontFamily: f400 }]}>
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
          <Text style={[styles.aboutText, { fontFamily: f400, textAlign: dir.textAlign }]}>
            {employeeBio || (dir.isRTL ? '—' : '—')}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).duration(700).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {dir.isRTL ? 'التخصصات' : 'Expertise'}
          </Text>
          <View style={[styles.tagRow, { flexDirection: dir.row }]}>
            {SPECIALTIES.map((s) => (
              <View
                key={s.en}
                style={[
                  styles.tag,
                  { backgroundColor: `${s.color}1e`, borderColor: `${s.color}33` },
                ]}
              >
                <Text style={[styles.tagText, { fontFamily: f600, color: s.color }]}>
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
                    <Star key={k} size={12} color={sawaaColors.accent.amber} strokeWidth={2} fill={sawaaColors.accent.amber} />
                  ))}
                </View>
                <Text style={[styles.reviewBy, { fontFamily: f700 }]}>
                  {dir.isRTL ? `${r.byAr} · ${r.whenAr}` : `${r.byEn} · ${r.whenEn}`}
                </Text>
              </View>
              <Text style={[styles.reviewText, { fontFamily: f400, textAlign: dir.textAlign }]}>
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
              <Text style={[styles.ctaPriceLabel, { fontFamily: f400 }]}>
                {dir.isRTL ? 'السعر لكل جلسة' : 'Per session'}
              </Text>
              <Text style={[styles.ctaPriceVal, { fontFamily: f700 }]}>
                {'٢٥٠ ⃁'}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push(`/(client)/booking/${id ?? '1'}`)}
              style={styles.ctaBtnPress}
            >
              <LinearGradient
                colors={[sawaaColors.teal[500], sawaaColors.teal[700]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaBtn}
              >
                <Text style={[styles.ctaBtnText, { fontFamily: f700 }]}>
                  {dir.isRTL ? 'احجز جلسة' : 'Book now'}
                </Text>
                <GoIcon size={14} color="#fff" strokeWidth={2} />
              </LinearGradient>
            </Pressable>
          </View>
        </Glass>
      </Animated.View>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 18 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  heroCard: { padding: 18 },
  heroRow: { alignItems: 'center', gap: 14 },
  avatar: {
    width: 80, height: 80, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', position: 'relative',
    shadowColor: '#e88f6c', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
  },
  avatarText: { fontSize: 32, color: '#fff' },
  onlineDot: {
    position: 'absolute', bottom: 4, right: 4,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#4bd67a', borderWidth: 2, borderColor: '#fff',
  },
  heroMid: { flex: 1 },
  heroName: { fontSize: 17, color: sawaaColors.ink[900] },
  heroSpec: { fontSize: 12, color: sawaaColors.ink[500], marginTop: 2 },
  rating: { alignItems: 'center', gap: 4, marginTop: 6 },
  ratingVal: { fontSize: 11, color: sawaaColors.ink[900] },
  ratingCount: { fontSize: 11, color: sawaaColors.ink[500] },
  statsRow: { marginTop: 14, gap: 8 },
  statBox: {
    flex: 1, paddingVertical: 10, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.55)',
    alignItems: 'center',
  },
  statN: { fontSize: 15, color: sawaaColors.teal[700] },
  statL: { fontSize: 10, color: sawaaColors.ink[500], marginTop: 2 },
  sectionTitle: { fontSize: 14, color: sawaaColors.ink[900], marginBottom: 8 },
  aboutText: { fontSize: 12.5, color: sawaaColors.ink[700], lineHeight: 22 },
  tagRow: { flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 12,
    borderWidth: 0.5,
  },
  tagText: { fontSize: 11 },
  reviewCard: { padding: 14 },
  reviewHead: { justifyContent: 'space-between', alignItems: 'center' },
  stars: { gap: 2 },
  reviewBy: { fontSize: 12.5, color: sawaaColors.ink[900] },
  reviewText: { fontSize: 12, color: sawaaColors.ink[700], marginTop: 6, lineHeight: 20 },
  ctaWrap: { position: 'absolute', left: 16, right: 16 },
  ctaPill: { padding: 6 },
  ctaRow: { alignItems: 'center', gap: 8, height: 46 },
  ctaPrice: { flex: 1, paddingHorizontal: 12 },
  ctaPriceLabel: { fontSize: 10, color: sawaaColors.ink[500] },
  ctaPriceVal: { fontSize: 13, color: sawaaColors.teal[700], marginTop: 2 },
  ctaBtnPress: { height: 46 },
  ctaBtn: {
    paddingHorizontal: 20, borderRadius: 999, height: 46,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    shadowColor: sawaaColors.teal[600], shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  ctaBtnText: { color: '#fff', fontSize: 13 },
});
