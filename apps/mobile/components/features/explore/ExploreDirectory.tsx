import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { DirectorySearch } from '@/components/features/directory/DirectorySearch';
import { ExploreCenter, ExploreBranches } from '@/components/features/explore/ExploreExtras';
import { EXPLORE_KINDS, ExploreResults } from '@/components/features/explore/ExploreResults';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { LocalizedHorizontalScroll } from '@/components/ui/LocalizedHorizontalScroll';
import { useClinics, useGroupSessions, usePackageFamilies, usePublicCatalog, useTherapists } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { buildExploreResults, filterExploreResults, type ExploreFilter, type ExploreResult } from '@/lib/explore-directory';
import { useAppSelector } from '@/hooks/use-redux';

const kindFromParam = (value: string | undefined): ExploreFilter | null =>
  EXPLORE_KINDS.find((kind) => kind.id === value)?.id ?? null;

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
  const params = useLocalSearchParams<{ filter?: string }>();
  const paramFilter = kindFromParam(params?.filter);
  const [filter, setFilter] = useState<ExploreFilter>(paramFilter ?? 'all');
  const [search, setSearch] = useState('');
  // Tabs stay mounted, so follow a new `filter` param after the first render too.
  useEffect(() => { if (paramFilter) setFilter(paramFilter); }, [paramFilter]);
  const font = getFontName(dir.locale, '400');
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
    return filterExploreResults(all, filter, search);
  }, [catalog.data, clinics.data, dir.locale, filter, packages.data, programs.data, search, therapists.data]);
  const searching = search.trim().length > 0;
  const overview = filter === 'all' && !searching;
  const retry = () => {
    void Promise.all(queries.filter((query) => query.isError).map((query) => query.refetch()));
  };

  const openResult = (result: ExploreResult) => {
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
      <DirectorySearch value={search} onChangeText={setSearch} placeholder={t('explore.searchPlaceholder')} accessibilityLabel={t('common.search')} testID="explore-search" />

      <LocalizedHorizontalScroll dir={dir} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label={t('explore.all')} selected={filter === 'all'} onPress={() => setFilter('all')} />
        {EXPLORE_KINDS.map((kind) => (
          <Chip key={kind.id} label={t(kind.labelKey)} selected={filter === kind.id} onPress={() => setFilter(kind.id)} />
        ))}
      </LocalizedHorizontalScroll>

      {loading ? (
        <View style={[styles.state, { flexDirection: dir.row }]}>
          <ActivityIndicator color={colors.teal[700]} />
          <Text style={[styles.stateText, { fontFamily: font }]}>{t('common.loading')}</Text>
        </View>
      ) : null}
      {failed ? (
        <EmptyState icon="cloud-offline-outline" tone="danger" title={t('guest.loadError')} actionLabel={t('common.retry')} onAction={retry} />
      ) : null}
      {!loading && !failed && results.length === 0 ? (
        <Text style={[styles.stateText, styles.empty, { fontFamily: font }]}>{t('common.noResults')}</Text>
      ) : null}
      <ExploreResults
        results={results}
        filter={filter}
        searching={searching}
        onOpen={openResult}
        onSelectKind={setFilter}
      />

      {overview ? <ExploreBranches /> : null}
      {overview ? <ExploreCenter /> : null}
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  directory: { gap: sawaaSpacing.lg },
  chips: { gap: 8, paddingVertical: 2 },
  state: { alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  stateText: { color: colors.ink[500], fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  empty: { textAlign: 'center', padding: 18 },
});
