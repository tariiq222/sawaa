import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, CalendarPlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { getCategoryBookingServices } from '@sawaa/shared/catalog';

import { ClinicProfileHeader } from '@/components/features/directory/ClinicProfileHeader';
import { ServiceRow } from '@/components/features/directory/ServiceRow';
import { TherapistCard } from '@/components/features/directory/TherapistCard';
import { bookingStepPath } from '@/features/booking/guest-booking-flow';
import { clinicBookingEntry } from '@/features/booking/booking-entry';
import { EmptyState } from '@/components/ui/EmptyState';
import { FloatingCta } from '@/components/ui/FloatingCta';
import { GlassSegmented } from '@/components/ui/GlassSegmented';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAppSelector } from '@/hooks/use-redux';
import { useClinics, usePublicCatalog, useTherapists } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { AquaBackground, sawaaRadius } from '@/theme/sawaa';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { getSawaaRoles, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';

type ClinicTab = 'about' | 'services' | 'therapists';

export default function ClinicDetailScreen() {
  const colors = useSawaaColors();
  const { scheme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const [tab, setTab] = useState<ClinicTab | null>(null);

  // The clinic directory is derived from the public catalog + bookable
  // therapists; this route renders one entry of that same list.
  const clinicsQuery = useClinics();
  const catalogQuery = usePublicCatalog();
  const therapistsQuery = useTherapists();
  const clinic = useMemo(
    () => (clinicsQuery.data ?? []).find((entry) => entry.id === id),
    [clinicsQuery.data, id],
  );

  const services = useMemo(() => {
    if (!clinic || clinic.bookingMode !== 'SERVICES' || !catalogQuery.data) return [];
    const category = catalogQuery.data.categories.find((item) => item.id === clinic.id);
    if (!category) return [];
    const allowedIds = new Set(clinic.serviceIds);
    return getCategoryBookingServices(category, catalogQuery.data.services).filter((service) => allowedIds.has(service.id));
  }, [catalogQuery.data, clinic]);
  const therapists = useMemo(() => {
    if (!clinic) return [];
    const serviceIds = new Set(clinic.serviceIds);
    return (therapistsQuery.data ?? []).filter((employee) => employee.serviceIds.some((serviceId) => serviceIds.has(serviceId)));
  }, [clinic, therapistsQuery.data]);

  const description = clinic
    ? (dir.isRTL ? clinic.descriptionAr : clinic.descriptionEn ?? clinic.descriptionAr) ?? null
    : null;
  // DIRECT clinics are booked through their hidden internal service, so they have no services tab.
  const hasServicesTab = clinic?.bookingMode === 'SERVICES';
  const tabs = [
    ...(hasServicesTab ? [{ value: 'services' as const, label: t('employeeProfile.services') }] : []),
    { value: 'therapists' as const, label: t('clinics.specialistsTab') },
    { value: 'about' as const, label: t('employeeProfile.about') },
  ];
  // Open on what the visitor came for; the description is one tap away.
  const activeTab: ClinicTab = tab ?? (hasServicesTab ? 'services' : 'therapists');

  const requestState = (loading: boolean, failed: boolean, emptyLabel: string, retry: () => unknown) => {
    const style = [styles.body, { color: colors.ink[500], fontFamily: f400, textAlign: dir.textAlign }];
    if (loading) {
      return <View style={[styles.requestState, { flexDirection: dir.row }]}><ActivityIndicator color={colors.teal[700]} /><Text style={style}>{t('common.loading')}</Text></View>;
    }
    if (failed) {
      return (
        <View style={styles.requestState}>
          <Text style={style}>{t('guest.loadError')}</Text>
          <Pressable onPress={() => { void retry(); }} accessibilityRole="button" style={styles.retryButton}>
            <Text style={[styles.retryText, { color: colors.teal[700], fontFamily: f600 }]}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      );
    }
    return <Text style={style}>{emptyLabel}</Text>;
  };

  const openTherapists = (serviceId?: string) => {
    if (!clinic) return;
    router.push({
      pathname: signedIn ? '/(client)/therapists' : '/public-list/[kind]',
      params: { ...(!signedIn ? { kind: 'therapists' } : {}), clinicId: clinic.id, ...(serviceId ? { serviceId } : {}), steps: '4' },
    });
  };

  const entry = clinic ? clinicBookingEntry(clinic) : null;
  const startBooking = () => {
    if (!clinic || !entry || entry.kind === 'misconfigured') return;
    if (entry.kind === 'service') {
      router.push({ pathname: bookingStepPath('service', signedIn), params: { clinicId: clinic.id, steps: String(entry.steps) } });
      return;
    }
    router.push({
      pathname: signedIn ? '/(client)/therapists' : '/public-list/[kind]',
      params: {
        ...(!signedIn ? { kind: 'therapists' } : {}),
        clinicId: clinic.id,
        serviceId: entry.serviceId,
        steps: String(entry.steps),
      },
    });
  };

  const renderTab = () => {
    if (activeTab === 'about') {
      return (
        <Text style={[styles.about, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>
          {description ?? t('clinics.noAbout')}
        </Text>
      );
    }
    if (activeTab === 'services') {
      return (
        <View style={styles.list}>
          {services.map((service) => {
            const serviceName = (dir.isRTL ? service.nameAr : service.nameEn) ?? service.nameAr;
            return (
              <ServiceRow
                key={service.id}
                title={serviceName}
                subtitle={(dir.isRTL ? service.descriptionAr : service.descriptionEn ?? service.descriptionAr) ?? null}
                onPress={() => openTherapists(service.id)}
              />
            );
          })}
          {services.length === 0 ? requestState(catalogQuery.isLoading, catalogQuery.isError, t('guest.empty'), catalogQuery.refetch) : null}
        </View>
      );
    }
    return (
      <View style={styles.list}>
        {therapists.map((therapist) => {
          const openProfile = () => router.push({
            pathname: signedIn ? '/(client)/employee/[id]' : '/public-detail/[kind]/[id]',
            params: signedIn
              ? { id: therapist.slug ?? therapist.id, clinicId: clinic?.id }
              : { kind: 'therapist', id: therapist.slug ?? therapist.id, clinicId: clinic?.id },
          });
          // A direct clinic has one fixed service: the card goes straight to the time step.
          if (clinic && entry?.kind === 'therapist') {
            return (
              <TherapistCard
                key={therapist.id}
                item={therapist}
                compact
                onPress={() => router.push({
                  pathname: signedIn ? '/(client)/booking/[serviceId]' : '/public-booking/[serviceId]',
                  params: { serviceId: entry.serviceId, employeeId: therapist.id, clinicId: clinic.id, steps: '2' },
                })}
                onViewProfile={openProfile}
              />
            );
          }
          return <TherapistCard key={therapist.id} item={therapist} compact onPress={openProfile} />;
        })}
        {therapists.length === 0 ? requestState(therapistsQuery.isLoading, therapistsQuery.isError, t('therapists.empty'), therapistsQuery.refetch) : null}
      </View>
    );
  };

  const renderBody = () => {
    if (clinicsQuery.isLoading) {
      return (
        <View style={styles.list}>
          <Skeleton height={152} radius={sawaaRadius.xl} />
          <Skeleton height={56} radius={sawaaRadius.lg} />
        </View>
      );
    }
    if (clinicsQuery.isError) {
      return (
        <EmptyState
          icon="alert-circle-outline"
          title={t('common.error')}
          actionLabel={t('common.retry')}
          onAction={() => { void clinicsQuery.refetch(); }}
          tone="danger"
        />
      );
    }
    if (!clinic) {
      return (
        <EmptyState
          icon="information-circle-outline"
          title={t('clinics.notFound')}
          actionLabel={t('clinics.title')}
          onAction={() => router.replace(signedIn ? '/(client)/clinics' : '/public-list/clinics')}
        />
      );
    }
    return (
      <>
        <ClinicProfileHeader clinic={clinic} placeholderIcon={Building2} />
        <GlassSegmented options={tabs} value={activeTab} onChange={setTab} />
        {renderTab()}
      </>
    );
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 180 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={t('clinics.profileTitle')} onBack={() => router.back()} />
        {renderBody()}
      </ScrollView>

      {clinic && entry ? (
        <FloatingCta>
          {entry.kind === 'misconfigured' ? (
            <Text style={[styles.body, { color: colors.ink[500], fontFamily: f400, textAlign: 'center' }]}>
              {t('clinics.bookingSetupMissing')}
            </Text>
          ) : null}
          <PrimaryButton
            label={t('employeeProfile.bookAppointment')}
            fontFamily={getFontName(dir.locale, '700')}
            icon={<CalendarPlus size={22} color={getSawaaRoles(scheme).action.foreground} strokeWidth={1.75} />}
            disabled={entry.kind === 'misconfigured'}
            onPress={startBooking}
          />
        </FloatingCta>
      ) : null}
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.xl },
  list: { gap: sawaaSpacing.md },
  about: { fontSize: 15, lineHeight: 26 },
  body: { fontSize: sawaaType.body.fontSize + 1, lineHeight: 22 },
  requestState: { alignItems: 'center', justifyContent: 'center', gap: sawaaSpacing.sm, padding: sawaaSpacing.md },
  retryButton: { minHeight: 44, paddingHorizontal: sawaaSpacing.lg, justifyContent: 'center' },
  retryText: { fontSize: 14, textDecorationLine: 'underline' },
});
