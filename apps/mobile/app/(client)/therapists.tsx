import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { LocalizedHorizontalScroll } from '@/components/ui/LocalizedHorizontalScroll';
import React, { useMemo, useState, useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Search, Star } from 'lucide-react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { AquaBackground, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useClinics, useTherapists } from '@/hooks/queries';
import { useReduceMotion } from '@/hooks/useA11y';
import { applyTherapistFilters, type TherapistChip } from './therapistsFilter';

const CHIPS: Array<{ key: Exclude<TherapistChip, null>; labelKey: string }> = [
  { key: 'available', labelKey: 'therapists.filters.available' },
  { key: 'women', labelKey: 'therapists.filters.women' },
  { key: 'remote', labelKey: 'therapists.filters.remote' },
  { key: 'under300', labelKey: 'therapists.filters.under300' },
];

export default function TherapistsListScreen() {
  const colors = useSawaaColors();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { clinicId } = useLocalSearchParams<{ clinicId?: string }>();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f500 = getFontName(dir.locale, '500');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const [activeChip, setActiveChip] = useState<TherapistChip>('available');
  const [query, setQuery] = useState('');
  const { data, isLoading } = useTherapists();
  const clinicsQuery = useClinics();
  const rawList = useMemo(() => data ?? [], [data]);
  const selectedClinic = useMemo(
    () => (clinicId ? (clinicsQuery.data ?? []).find((clinic) => clinic.id === clinicId) : undefined),
    [clinicId, clinicsQuery.data],
  );
  const clinicServiceIds = useMemo(
    () => selectedClinic ? new Set(selectedClinic.serviceIds) : null,
    [selectedClinic],
  );
  const list = useMemo(() => {
    if (!clinicServiceIds) return rawList;
    return rawList.filter((therapist) => therapist.serviceIds.some((serviceId) => clinicServiceIds.has(serviceId)));
  }, [clinicServiceIds, rawList]);
  const loading = isLoading;

  const filtered = useMemo(
    () => applyTherapistFilters(list, query, activeChip),
    [list, query, activeChip],
  );

  const renderItem = useCallback(({ item, index }: { item: typeof list[0]; index: number }) => {
    const name = (dir.isRTL ? item.nameAr : item.nameEn) ?? item.nameEn ?? item.nameAr ?? t('therapists.unknownName');
    const spec = (dir.isRTL ? item.specialtyAr : item.specialty) ?? item.specialty ?? item.specialtyAr ?? '';
    const gradient = theme.colors.primaryGradient;
    const initial = name.charAt(0);
    const navKey = item.slug ?? item.id;

    return (
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.delay(280 + index * 80).duration(700).easing(Easing.out(Easing.cubic))}
      >
        <Glass variant="strong" radius={sawaaRadius.xl} style={styles.therapistCard}>
          <Pressable
            onPress={() => router.push(`/(client)/employee/${navKey}`)}
            style={[styles.therapistRow, { flexDirection: dir.row }]}
            accessibilityRole="button"
            accessibilityLabel={`${name}, ${spec}`}
            testID={`therapist-${item.id}`}
          >
            <LinearGradient
              colors={gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={[styles.avatarText, { fontFamily: f700, color: theme.colors.primaryForeground }]}>{initial}</Text>
            </LinearGradient>
            <View style={styles.therapistBody}>
              <View style={[styles.therapistTop, { flexDirection: dir.row }]}>
                <Text style={[styles.therapistName, { fontFamily: f700, textAlign: dir.textAlign, flex: 1 }]}>
                  {name}
                </Text>
              </View>
              <Text style={[styles.therapistSpec, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
                {spec}
              </Text>
              {item.title ? (
                <View style={[styles.therapistMeta, { flexDirection: dir.row }]}>
                  <AppIcon sf="star.fill" fallback={Star} size={11} color={colors.accent.amber} strokeWidth={2} />
                  <Text style={[styles.therapistExp, { fontFamily: f500, fontWeight: '500' }]}> 
                    {item.title}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        </Glass>
      </Animated.View>
    );
  }, [colors, styles, theme, dir, f400, f500, f700, reduceMotion, router, t]);

  const screenTitle = selectedClinic
    ? (dir.isRTL ? selectedClinic.nameAr : (selectedClinic.nameEn ?? selectedClinic.nameAr))
    : t('therapists.title');

  const ListHeader = useMemo(() => (
    <View style={styles.header}>
      <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(500)}>
        <Glass variant="strong" radius={22} onPress={() => router.back()} interactive accessibilityLabel={t('a11y.buttonBack')} style={[styles.backBtn, { alignSelf: dir.alignStart }]}>
          <BackIcon size={22} color={colors.ink[700]} strokeWidth={1.75} />
        </Glass>
      </Animated.View>

      <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(600).easing(Easing.out(Easing.cubic))}>
        <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign }]}> 
          {screenTitle}
        </Text>
        <Text style={[styles.subtitle, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}> 
          {t('therapists.availableCount', { count: list.length })}
        </Text>
      </Animated.View>

      <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(160).duration(700).easing(Easing.out(Easing.cubic))}>
        <Glass variant="strong" radius={sawaaRadius.xl} style={styles.searchCard}>
          <View style={[styles.searchRow, { flexDirection: dir.row }]}>
            <AppIcon sf="magnifyingglass" fallback={Search} size={17} color={colors.ink[500]} strokeWidth={1.75} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('therapists.searchPlaceholder')}
              placeholderTextColor={colors.ink[400]}
              accessibilityLabel={t('a11y.searchTherapists')}
              testID="therapist-search"
              style={[
                styles.searchInput,
                { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign, writingDirection: dir.writingDirection, color: colors.ink[900] },
              ]}
            />
          </View>
        </Glass>
      </Animated.View>

      <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(220).duration(600).easing(Easing.out(Easing.cubic))}>
        <LocalizedHorizontalScroll
          dir={dir}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.chipsRow, { flexDirection: dir.row }]}
        >
          {CHIPS.map((chip) => {
            const isActive = chip.key === activeChip;
            return (
              <Pressable
                key={chip.key}
                onPress={() => setActiveChip((prev) => (prev === chip.key ? null : chip.key))}
              >
                <Glass
                  variant={isActive ? 'strong' : 'regular'}
                  radius={14}
                  style={[
                    styles.chip,
                    isActive && { backgroundColor: theme.colors.primaryFill },
                  ]}
                >
                  <Text style={[
                    styles.chipText,
                    { fontFamily: f600, fontWeight: '600', color: isActive ? theme.colors.primaryForeground : colors.ink[700] },
                  ]}>
                    {t(chip.labelKey)}
                  </Text>
                </Glass>
              </Pressable>
            );
          })}
        </LocalizedHorizontalScroll>
      </Animated.View>
    </View>
  ), [colors, styles, theme, BackIcon, activeChip, dir, f400, f600, f700, list.length, query, reduceMotion, router, screenTitle, t]);

  const ListEmpty = useMemo(() => {
    if (loading) {
      return (
        <Text style={[styles.subtitle, { fontFamily: f400, fontWeight: '400', paddingHorizontal: 4 }]}> 
          {t('therapists.loading')}
        </Text>
      );
    }
    return (
      <Text style={[styles.subtitle, { fontFamily: f400, fontWeight: '400', paddingHorizontal: 4 }]}> 
        {t('therapists.empty')}
      </Text>
    );
  }, [styles, f400, loading, t]);

  return (
    <AquaBackground>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        scrollEventThrottle={16}
      />
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: 16 },
  header: { gap: 14, marginBottom: 14 },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  title: { fontSize: 22, color: colors.ink[900], paddingHorizontal: 4 },
  subtitle: { fontSize: 12, color: colors.ink[500], marginTop: 2, paddingHorizontal: 4 },
  searchCard: { padding: 0 },
  searchRow: { alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, fontSize: 13, height: 22 },
  chipsRow: { gap: 6, paddingHorizontal: 2, paddingVertical: 2 },
  chip: { paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 11.5 },
  therapistCard: { padding: 0, overflow: 'hidden', marginBottom: 14 },
  therapistRow: { alignItems: 'stretch' },
  avatar: {
    width: 84, alignItems: 'center', justifyContent: 'flex-end',
    paddingBottom: 8, position: 'relative',
  },
  avatarText: { fontSize: 36, color: colors.ink[900] },
  therapistBody: { flex: 1, padding: 12 },
  therapistTop: { justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  therapistName: { fontSize: 14, color: colors.ink[900] },
  therapistSpec: { fontSize: 11.5, color: colors.ink[500], marginTop: 3 },
  therapistMeta: { alignItems: 'center', gap: 6, marginTop: 8 },
  therapistExp: { fontSize: 11, color: colors.ink[500] },
});
