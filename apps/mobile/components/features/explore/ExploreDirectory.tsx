import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { useClinics, useGroupSessions, usePackageFamilies, usePublicCatalog, useTherapists } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { buildExploreResults, filterExploreResults, type ExploreFilter } from '@/lib/explore-directory';
import { Glass } from '@/theme/components/Glass';
import { useAppSelector } from '@/hooks/use-redux';

const CATEGORIES: Array<{ id: Exclude<ExploreFilter, 'all'>; labelKey: string }> = [
  { id: 'clinic', labelKey: 'clinics.title' },
  { id: 'service', labelKey: 'guest.services' },
  { id: 'therapist', labelKey: 'guest.therapists' },
  { id: 'package', labelKey: 'guest.packages' },
  { id: 'program', labelKey: 'guest.programs' },
];

export function ExploreDirectory() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const dir = useDir();
  const router = useRouter();
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const clinics = useClinics();
  const catalog = usePublicCatalog();
  const therapists = useTherapists();
  const packages = usePackageFamilies();
  const programs = useGroupSessions();
  const [filter, setFilter] = useState<ExploreFilter | null>(null);
  const [search, setSearch] = useState('');
  const font = getFontName(dir.locale, '400');
  const bold = getFontName(dir.locale, '700');
  const queries = [clinics, catalog, therapists, packages, programs];
  const loading = queries.some((query) => query.isLoading);
  const failed = queries.some((query) => query.isError);
  const results = useMemo(() => {
    if (!catalog.data) return [];
    const all = buildExploreResults({
      clinics: clinics.data ?? [],
      catalog: catalog.data,
      therapists: therapists.data ?? [],
      packages: packages.data ?? [],
      programs: programs.data ?? [],
      locale: dir.locale,
    });
    return filterExploreResults(all, filter ?? 'all', search);
  }, [catalog.data, clinics.data, dir.locale, filter, packages.data, programs.data, search, therapists.data]);
  const isCategoryHome = filter === null && search.trim().length === 0;
  const ForwardIcon = dir.isRTL ? ChevronLeft : ChevronRight;
  const retry = () => {
    void Promise.all(queries.filter((query) => query.isError).map((query) => query.refetch()));
  };

  const openResult = (result: (typeof results)[number]) => {
    if (signedIn) {
      router.push(result.route);
      return;
    }

    if (result.kind === 'clinic') {
      router.push({ pathname: '/public-clinic/[id]', params: { id: result.id } });
      return;
    }

    if (result.kind === 'service') {
      const clinic = clinics.data?.find((entry) => entry.serviceIds.includes(result.id));
      router.push({ pathname: '/public-detail/[kind]/[id]', params: { kind: 'service', id: result.id, ...(clinic ? { clinicId: clinic.id } : {}) } });
      return;
    }

    const params = typeof result.route === 'object' && result.route !== null && 'params' in result.route
      ? result.route.params
      : undefined;
    if (result.kind === 'therapist') {
      router.push({ pathname: '/public-detail/[kind]/[id]', params: { kind: 'therapist', id: params?.id ?? result.id } });
    } else {
      router.push({ pathname: '/public-detail/[kind]/[id]', params: { kind: result.kind, id: result.id } });
    }
  };

  return (
    <View style={styles.directory}>
      <Glass variant="strong" radius={16}>
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder={t('explore.searchPlaceholder')}
        placeholderTextColor={colors.ink[500]}
        accessibilityLabel={t('common.search')}
        testID="explore-search"
        style={[styles.search, { fontFamily: font, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}
      />
      </Glass>

      {filter !== null ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.buttonBack')}
          onPress={() => { setFilter(null); setSearch(''); }}
          style={[styles.backToCategories, { flexDirection: dir.row, alignSelf: dir.alignStart }]}
        >
          <AppIcon
            sf={dir.isRTL ? 'chevron.right' : 'chevron.left'}
            fallback={dir.isRTL ? ChevronRight : ChevronLeft}
            size={18}
            color={colors.teal[700]}
          />
          <Text style={[styles.backText, { fontFamily: bold }]}>{t('a11y.buttonBack')}</Text>
        </Pressable>
      ) : null}

      {isCategoryHome ? (
        <View style={styles.categories}>
          {CATEGORIES.map((category) => (
            <Glass
              key={category.id}
              variant="strong"
              radius={18}
              interactive
              accessibilityRole="button"
              accessibilityLabel={t(category.labelKey)}
              onPress={() => setFilter(category.id)}
              style={styles.category}
            >
              <View style={[styles.categoryRow, { flexDirection: dir.row }]}>
                <Text style={[styles.categoryText, { fontFamily: bold, textAlign: dir.textAlign, flex: 1 }]}>{t(category.labelKey)}</Text>
                <AppIcon
                  sf={dir.isRTL ? 'chevron.left' : 'chevron.right'}
                  fallback={ForwardIcon}
                  size={18}
                  color={colors.ink[500]}
                />
              </View>
            </Glass>
          ))}
        </View>
      ) : null}

      {!isCategoryHome && loading ? (
        <View style={[styles.state, { flexDirection: dir.row }]}>
          <ActivityIndicator color={colors.teal[700]} />
          <Text style={[styles.stateText, { fontFamily: font }]}>{t('common.loading')}</Text>
        </View>
      ) : null}
      {!isCategoryHome && failed ? (
        <View style={styles.errorState}>
          <Text style={[styles.stateText, { fontFamily: font, textAlign: dir.textAlign }]}>{t('guest.loadError')}</Text>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
            <Text style={[styles.retryText, { fontFamily: bold }]}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      ) : null}
      {!isCategoryHome && !loading && !failed && results.length === 0 ? (
        <Text style={[styles.stateText, styles.empty, { fontFamily: font }]}>{t('common.noResults')}</Text>
      ) : null}
      {!isCategoryHome ? (
        <View style={styles.results}>
          {results.map((result) => (
            <Glass
              key={`${result.kind}-${result.id}`}
              variant="strong"
              radius={18}
              interactive
              onPress={() => openResult(result)}
              accessibilityRole="button"
              accessibilityLabel={result.detail && result.detail !== result.title ? `${result.title}, ${result.detail}` : result.title}
              testID={`explore-result-${result.kind}-${result.id}`}
              style={styles.result}
            >
              <Text style={[styles.resultTitle, { fontFamily: bold, textAlign: dir.textAlign }]}>{result.title}</Text>
              {result.detail && result.detail !== result.title ? (
                <Text style={[styles.resultDetail, { fontFamily: font, textAlign: dir.textAlign }]}>{result.detail}</Text>
              ) : null}
            </Glass>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  directory: { gap: 14 },
  search: { minHeight: 50, borderRadius: 16, paddingHorizontal: 16, color: colors.ink[900], fontSize: 15 },
  categories: { gap: 10 },
  category: { minHeight: 64, paddingHorizontal: 16, justifyContent: 'center' },
  categoryRow: { alignItems: 'center', gap: 12 },
  categoryText: { color: colors.ink[900], fontSize: 15 },
  backToCategories: { minHeight: 40, alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  backText: { color: colors.teal[700], fontSize: 13 },
  state: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  stateText: { color: colors.ink[500], fontSize: 14 },
  errorState: { alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: colors.glass.opaqueBg },
  retry: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.teal[700] },
  retryText: { color: colors.glass.opaqueBg, fontSize: 13 },
  empty: { textAlign: 'center', padding: 18 },
  results: { gap: 10 },
  result: { minHeight: 68, justifyContent: 'center', gap: 4, padding: 15 },
  resultTitle: { color: colors.ink[900], fontSize: 15 },
  resultDetail: { color: colors.ink[500], fontSize: 13 },
});
