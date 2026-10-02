import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/Chip';
import { LocalizedHorizontalScroll } from '@/components/ui/LocalizedHorizontalScroll';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { BookingStepHeader } from '@/components/features/booking/BookingStepHeader';
import { DirectorySearch } from '@/components/features/directory/DirectorySearch';
import { TherapistCard } from '@/components/features/directory/TherapistCard';
import { useDir } from '@/hooks/useDir';
import { useClinics, useServicePriceFloors, useTherapists } from '@/hooks/queries';
import { bookingStep, stepsAfterSkip } from '@/features/booking/booking-entry';
import { applyTherapistFilters, type TherapistChip } from '@/features/therapists/therapistsFilter';
import type { PublicEmployeeItem } from '@/services/client/employees';
import { getFontName } from '@/theme/fonts';
import { AquaBackground } from '@/theme/sawaa';
import { sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

const CHIPS: Array<{ key: Exclude<TherapistChip, null>; labelKey: string }> = [
  { key: 'available', labelKey: 'therapists.filters.available' },
  { key: 'women', labelKey: 'therapists.filters.women' },
  { key: 'remote', labelKey: 'therapists.filters.remote' },
  { key: 'under300', labelKey: 'therapists.filters.under300' },
];

export default function TherapistsListScreen() {
  const colors = useSawaaColors();
  const router = useRouter();
  const { clinicId, serviceId, steps } = useLocalSearchParams<{ clinicId?: string; serviceId?: string; steps?: string }>();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  // A specialist with future openings is still a valid result for the clinic
  // or service the client selected. Today's availability is an opt-in filter.
  const [activeChip, setActiveChip] = useState<TherapistChip>(null);
  const [query, setQuery] = useState('');
  const therapistsQuery = useTherapists();
  const { data, isLoading: therapistsLoading, isError: therapistDirectoryFailed, refetch: refetchTherapists } = therapistsQuery;
  const clinicsQuery = useClinics();
  const { isLoading: clinicsLoading, isError: clinicsFailed, refetch: refetchClinics } = clinicsQuery;
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
    if (!clinicId) return serviceId ? rawList.filter((therapist) => therapist.serviceIds.includes(serviceId)) : rawList;
    if (!clinicServiceIds) return [];
    if (serviceId && !clinicServiceIds.has(serviceId)) return [];
    return rawList.filter((therapist) => therapist.serviceIds.some((id) => clinicServiceIds.has(id) && (!serviceId || id === serviceId)));
  }, [clinicId, clinicServiceIds, rawList, serviceId]);
  const clinicDirectoryRequired = Boolean(clinicId);
  const loading = therapistsLoading || (clinicDirectoryRequired && clinicsLoading);
  const clinicDirectoryFailed = clinicDirectoryRequired && clinicsFailed;
  const directoryFailed = therapistDirectoryFailed || clinicDirectoryFailed;

  const filtered = useMemo(
    () => applyTherapistFilters(list, query, activeChip),
    [list, query, activeChip],
  );

  const listIds = useMemo(() => (serviceId ? list.map((therapist) => therapist.id) : []), [list, serviceId]);
  const priceFloors = useServicePriceFloors(serviceId, listIds);

  const timeStepParams = useCallback((employeeId: string, nextSteps: string | undefined) => ({
    serviceId: serviceId as string,
    employeeId,
    ...(clinicId ? { clinicId } : {}),
    ...(nextSteps ? { steps: nextSteps } : {}),
  }), [clinicId, serviceId]);

  // One matching therapist: nothing to choose, go straight to the time step.
  const focused = useIsFocused();
  const skipped = useRef(false);
  useEffect(() => {
    if (!serviceId || !focused || skipped.current || loading || directoryFailed || list.length !== 1) return;
    skipped.current = true;
    router.replace({
      pathname: '/(client)/booking/[serviceId]',
      params: timeStepParams(list[0].id, stepsAfterSkip(steps)),
    });
  }, [serviceId, focused, loading, directoryFailed, list, router, steps, timeStepParams]);

  const renderItem = useCallback(({ item }: { item: PublicEmployeeItem }) => {
    const openProfile = () => router.push({
      pathname: '/(client)/employee/[id]',
      params: {
        id: item.slug ?? item.id,
        ...(clinicId ? { clinicId } : {}),
        ...(serviceId ? { serviceId } : {}),
        ...(serviceId && steps ? { steps } : {}),
      },
    });
    if (!serviceId) return <TherapistCard item={item} onPress={openProfile} />;
    return (
      <TherapistCard
        item={item}
        onPress={() => router.push({ pathname: '/(client)/booking/[serviceId]', params: timeStepParams(item.id, steps) })}
        onViewProfile={openProfile}
        servicePrice={priceFloors[item.id] ?? null}
      />
    );
  }, [router, clinicId, serviceId, steps, priceFloors, timeStepParams]);

  const screenTitle = selectedClinic
    ? (dir.isRTL ? selectedClinic.nameAr : (selectedClinic.nameEn ?? selectedClinic.nameAr))
    : t('therapists.listTitle');

  const errorBlock = (testID: string, retry: () => unknown) => (
    <View style={styles.errorBlock}>
      <Text style={[styles.message, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>{t('guest.loadError')}</Text>
      <Pressable onPress={() => { void retry(); }} accessibilityRole="button" testID={testID} style={styles.retry}>
        <Text style={[styles.retryText, { color: colors.teal[700], fontFamily: f600 }]}>{t('common.retry')}</Text>
      </Pressable>
    </View>
  );

  const ListHeader = (
    <View style={styles.header}>
      {serviceId && steps ? (
        <BookingStepHeader
          {...bookingStep('therapist', steps)}
          title={t('booking.chooseTherapist')}
          onBack={() => router.back()}
        />
      ) : (
        <ScreenHeader title={screenTitle} onBack={() => router.back()} />
      )}
      <DirectorySearch
        value={query}
        onChangeText={setQuery}
        placeholder={t('therapists.searchPlaceholder')}
        accessibilityLabel={t('a11y.searchTherapists')}
        testID="therapist-search"
      />
      <LocalizedHorizontalScroll
        dir={dir}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.chipsRow, { flexDirection: dir.row }]}
      >
        <Chip label={t('therapists.filters.all')} selected={activeChip === null} onPress={() => setActiveChip(null)} />
        {CHIPS.map((chip) => (
          <Chip
            key={chip.key}
            label={t(chip.labelKey)}
            selected={chip.key === activeChip}
            onPress={() => setActiveChip((prev) => (prev === chip.key ? null : chip.key))}
          />
        ))}
      </LocalizedHorizontalScroll>
      {directoryFailed ? (
        <View style={styles.errorList}>
          {therapistDirectoryFailed ? errorBlock('therapist-directory-retry', refetchTherapists) : null}
          {clinicDirectoryFailed ? errorBlock('clinic-directory-retry', refetchClinics) : null}
        </View>
      ) : null}
    </View>
  );

  const ListEmpty = loading ? (
    <Text style={[styles.message, { color: colors.ink[500], fontFamily: f400, textAlign: dir.textAlign }]}>{t('therapists.loading')}</Text>
  ) : directoryFailed ? null : (
    <Text style={[styles.message, { color: colors.ink[500], fontFamily: f400, textAlign: dir.textAlign }]}>{t('therapists.empty')}</Text>
  );

  return (
    <AquaBackground>
      <FlatList
        data={filtered}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        keyboardShouldPersistTaps="handled"
      />
    </AquaBackground>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg },
  header: { gap: sawaaSpacing.md, marginBottom: sawaaSpacing.xl },
  chipsRow: { gap: sawaaSpacing.sm },
  separator: { height: sawaaSpacing.md },
  message: { fontSize: sawaaType.body.fontSize + 1, lineHeight: 22 },
  errorList: { gap: sawaaSpacing.sm },
  errorBlock: { gap: 4 },
  retry: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  retryText: { fontSize: 14, textDecorationLine: 'underline' },
});
