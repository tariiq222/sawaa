import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { BookingStepHeader } from '@/components/features/booking/BookingStepHeader';
import { ClinicCard, filterClinics } from '@/components/features/directory/ClinicCard';
import { DirectorySearch } from '@/components/features/directory/DirectorySearch';
import { ServiceRow } from '@/components/features/directory/ServiceRow';
import { TherapistCard } from '@/components/features/directory/TherapistCard';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useClinics, useTherapists, useGroupSessions, usePackageFamilies, useServicePriceFloors } from '@/hooks/queries';
import { bookingStep, stepsAfterSkip } from '@/features/booking/booking-entry';
import { useDir } from '@/hooks/useDir';
import { applyTherapistFilters } from '@/features/therapists/therapistsFilter';
import type { ClinicEntry } from '@/lib/clinics';
import { goBackOrHome } from '@/lib/navigation';
import type { PublicEmployeeItem } from '@/services/client/employees';
import { getFontName } from '@/theme/fonts';
import { AquaBackground } from '@/theme/sawaa';
import { sawaaSpacing } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useAppSelector } from '@/hooks/use-redux';

type Entry =
  | { key: string; kind: 'clinic'; clinic: ClinicEntry }
  | { key: string; kind: 'therapist'; therapist: PublicEmployeeItem }
  | { key: string; kind: 'package' | 'program'; id: string; title: string; subtitle: string | null };

export default function PublicListScreen() {
  const { kind, clinicId, serviceId, steps } = useLocalSearchParams<{ kind?: string; clinicId?: string; serviceId?: string; steps?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const insets = useSafeAreaInsets();
  const isGuest = !useAppSelector((state) => state.auth.token);
  const [query, setQuery] = useState('');
  const clinics = useClinics();
  const therapists = useTherapists();
  const programs = useGroupSessions();
  const families = usePackageFamilies();
  const selectedClinic = clinics.data?.find((clinic) => clinic.id === clinicId);
  const serviceMatchesClinic = !clinicId || !serviceId || selectedClinic?.serviceIds.includes(serviceId) === true;
  const therapistData = therapists.data;
  const visibleTherapists = useMemo(() => (therapistData ?? []).filter((person) =>
    serviceMatchesClinic
    && (!clinicId || (selectedClinic != null && person.serviceIds.some((id) => selectedClinic.serviceIds.includes(id))))
    && (!serviceId || person.serviceIds.includes(serviceId))), [therapistData, serviceMatchesClinic, clinicId, selectedClinic, serviceId]);
  const searchable = kind === 'clinics' || kind === 'therapists';

  const entries: Entry[] = (() => {
    if (kind === 'clinics') {
      return filterClinics(clinics.data ?? [], query).map((clinic) => ({ key: `clinic-${clinic.id}`, kind: 'clinic', clinic }));
    }
    if (kind === 'therapists') {
      return applyTherapistFilters(visibleTherapists, query, null).map((therapist) => ({ key: `therapist-${therapist.id}`, kind: 'therapist', therapist }));
    }
    if (kind === 'packages') {
      return (families.data ?? []).map((item) => ({
        key: `package-${item.id}`,
        kind: 'package',
        id: item.id,
        title: (dir.isRTL ? item.nameAr : item.nameEn ?? item.nameAr) ?? '',
        subtitle: (dir.isRTL ? item.descriptionAr : item.descriptionEn ?? item.descriptionAr) ?? null,
      }));
    }
    if (kind === 'programs') {
      return (programs.data ?? []).map((item) => ({
        key: `program-${item.id}`,
        kind: 'program',
        id: item.id,
        title: (dir.isRTL ? item.nameAr : item.nameEn ?? item.nameAr) ?? '',
        subtitle: null,
      }));
    }
    return [];
  })();

  const valid = kind === 'clinics' || kind === 'therapists' || kind === 'packages' || kind === 'programs';
  const loading = kind === 'clinics' ? clinics.isLoading
    : kind === 'therapists' ? therapists.isLoading || Boolean(clinicId && clinics.isLoading)
      : kind === 'packages' ? families.isLoading : programs.isLoading;
  const activeQuery = kind === 'clinics' ? clinics : kind === 'therapists' ? therapists
    : kind === 'packages' ? families : programs;
  const needsClinicContext = kind === 'therapists' && Boolean(clinicId);
  const loadError = valid && (activeQuery.isError || (needsClinicContext && clinics.isError));
  const retry = () => {
    void activeQuery.refetch();
    if (needsClinicContext) void clinics.refetch();
  };
  const title = kind === 'clinics' ? t('clinics.title') : kind === 'therapists' ? t('guest.therapists') : kind === 'packages' ? t('guest.packages') : t('guest.programs');

  const therapistStep = kind === 'therapists' && Boolean(serviceId);
  const priceFloors = useServicePriceFloors(
    therapistStep ? serviceId : undefined,
    useMemo(() => (therapistStep ? visibleTherapists.map((person) => person.id) : []), [therapistStep, visibleTherapists]),
  );
  const timeStepParams = useCallback((employeeId: string, nextSteps: string | undefined) => ({
    serviceId: serviceId as string,
    employeeId,
    ...(clinicId ? { clinicId } : {}),
    ...(nextSteps ? { steps: nextSteps } : {}),
  }), [clinicId, serviceId]);

  // One matching therapist: nothing to choose, go straight to the time step.
  const focused = useIsFocused();
  const skipped = useRef(false);
  const onlyTherapistId = visibleTherapists.length === 1 ? visibleTherapists[0].id : null;
  useEffect(() => {
    if (!therapistStep || !focused || skipped.current || loading || loadError || !onlyTherapistId) return;
    skipped.current = true;
    router.replace({
      pathname: '/public-booking/[serviceId]',
      params: timeStepParams(onlyTherapistId, stepsAfterSkip(steps)),
    });
  }, [therapistStep, focused, loading, loadError, onlyTherapistId, router, steps, timeStepParams]);

  const openDetail = (detailKind: string, id: string, extra: Record<string, string> = {}) =>
    router.push({ pathname: '/public-detail/[kind]/[id]', params: { kind: detailKind, id, ...extra } });

  const renderItem = ({ item }: { item: Entry }) => {
    if (item.kind === 'clinic') {
      return (
        <ClinicCard
          clinic={item.clinic}
          onPress={() => router.push({ pathname: isGuest ? '/public-clinic/[id]' : '/(client)/clinic/[id]', params: { id: item.clinic.id } })}
        />
      );
    }
    if (item.kind === 'therapist') {
      const therapist = item.therapist;
      const openProfile = () => openDetail('therapist', therapist.slug ?? therapist.id, {
        ...(clinicId ? { clinicId } : {}),
        ...(serviceId ? { serviceId } : {}),
        ...(therapistStep && steps ? { steps } : {}),
      });
      if (!therapistStep) return <TherapistCard item={therapist} onPress={openProfile} />;
      return (
        <TherapistCard
          item={therapist}
          onPress={() => router.push({ pathname: '/public-booking/[serviceId]', params: timeStepParams(therapist.id, steps) })}
          onViewProfile={openProfile}
          servicePrice={priceFloors[therapist.id] ?? null}
        />
      );
    }
    return <ServiceRow title={item.title} subtitle={item.subtitle} onPress={() => openDetail(item.kind, item.id)} />;
  };

  return (
    <AquaBackground>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.key}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={(
          <View style={styles.header}>
            {therapistStep && steps ? (
              <BookingStepHeader
                {...bookingStep('therapist', steps)}
                title={t('booking.chooseTherapist')}
                onBack={() => goBackOrHome(router)}
              />
            ) : (
              <ScreenHeader title={title} onBack={() => goBackOrHome(router)} />
            )}
            {searchable ? (
              <DirectorySearch
                value={query}
                onChangeText={setQuery}
                placeholder={kind === 'clinics' ? t('clinics.searchPlaceholder') : t('therapists.searchPlaceholder')}
                accessibilityLabel={kind === 'clinics' ? t('clinics.searchPlaceholder') : t('a11y.searchTherapists')}
                testID="public-list-search"
              />
            ) : null}
            {valid && loading ? <ActivityIndicator color={colors.teal[700]} /> : null}
            {loadError ? (
              <View style={styles.error}>
                <Text style={[styles.errorText, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400') }]}>
                  {t('guest.loadError')}
                </Text>
                <Pressable accessibilityRole="button" accessibilityLabel={t('common.retry')} onPress={retry} style={styles.retry}>
                  <Text style={{ color: colors.teal[700], fontFamily: getFontName(dir.locale, '700') }}>{t('common.retry')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        )}
        ListEmptyComponent={!loading && !loadError ? (
          <Text style={[styles.empty, { color: colors.ink[500], fontFamily: getFontName(dir.locale, '400') }]}>{t('guest.empty')}</Text>
        ) : null}
        renderItem={renderItem}
      />
    </AquaBackground>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg, flexGrow: 1 },
  header: { gap: sawaaSpacing.md, marginBottom: sawaaSpacing.xl },
  separator: { height: sawaaSpacing.md },
  error: { alignItems: 'center', gap: sawaaSpacing.sm },
  errorText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retry: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: sawaaSpacing.md },
  empty: { fontSize: 15, lineHeight: 22, textAlign: 'center', padding: sawaaSpacing['2xl'] },
});
