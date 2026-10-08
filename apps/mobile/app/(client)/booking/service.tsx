import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getCategoryBookingServices } from '@sawaa/shared/catalog';

import { BookingStepHeader } from '@/components/features/booking/BookingStepHeader';
import { ServiceRow } from '@/components/features/directory/ServiceRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { bookingStep } from '@/features/booking/booking-entry';
import { useAppSelector } from '@/hooks/use-redux';
import { useClinics, usePublicCatalog } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import { goBackOrHome } from '@/lib/navigation';
import { getFontName } from '@/theme/fonts';
import { AquaBackground, sawaaRadius } from '@/theme/sawaa';
import { sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

/** Booking step 1 (SERVICES clinics only): pick a visible service, then continue to the therapist list. */
export default function BookingServiceScreen() {
  const colors = useSawaaColors();
  const { clinicId, steps } = useLocalSearchParams<{ clinicId?: string; steps?: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');

  const clinicsQuery = useClinics();
  const catalogQuery = usePublicCatalog();
  const clinic = useMemo(
    () => (clinicsQuery.data ?? []).find((entry) => entry.id === clinicId),
    [clinicsQuery.data, clinicId],
  );
  const services = useMemo(() => {
    if (!clinic || clinic.bookingMode !== 'SERVICES' || !catalogQuery.data) return [];
    const category = catalogQuery.data.categories.find((item) => item.id === clinic.id);
    if (!category) return [];
    const allowedIds = new Set(clinic.serviceIds);
    return getCategoryBookingServices(category, catalogQuery.data.services).filter((service) => allowedIds.has(service.id));
  }, [catalogQuery.data, clinic]);

  const { step, total } = bookingStep('service', steps ?? '4');
  const textStyle = [styles.body, { color: colors.ink[500], fontFamily: f400, textAlign: dir.textAlign }];

  const chooseService = (serviceId: string) => {
    if (!clinic) return;
    router.push({
      pathname: signedIn ? '/(client)/therapists' : '/public-list/[kind]',
      params: {
        ...(!signedIn ? { kind: 'therapists' } : {}),
        clinicId: clinic.id,
        serviceId,
        steps: String(total),
      },
    });
  };

  const renderList = () => {
    if (clinicsQuery.isLoading || (catalogQuery.isLoading && services.length === 0)) {
      return (
        <View style={styles.list}>
          <Skeleton height={64} radius={sawaaRadius.lg} />
          <Skeleton height={64} radius={sawaaRadius.lg} />
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
    if (services.length > 0) {
      return (
        <View style={styles.list}>
          {services.map((service) => (
            <ServiceRow
              key={service.id}
              title={(dir.isRTL ? service.nameAr : service.nameEn) ?? service.nameAr}
              subtitle={(dir.isRTL ? service.descriptionAr : service.descriptionEn ?? service.descriptionAr) ?? null}
              onPress={() => chooseService(service.id)}
            />
          ))}
        </View>
      );
    }
    if (catalogQuery.isError) {
      return (
        <View style={styles.requestState}>
          <Text style={textStyle}>{t('guest.loadError')}</Text>
          <Pressable onPress={() => { void catalogQuery.refetch(); }} accessibilityRole="button" style={styles.retryButton}>
            <Text style={[styles.retryText, { color: colors.teal[700], fontFamily: f600 }]}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={[styles.requestState, { flexDirection: dir.row }]}>
        {catalogQuery.isLoading ? <ActivityIndicator color={colors.teal[700]} /> : null}
        <Text style={textStyle}>{t('guest.empty')}</Text>
      </View>
    );
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        <BookingStepHeader step={step} total={total} title={t('booking.chooseService')} onBack={() => goBackOrHome(router, signedIn ? '/(client)/(tabs)/home' : '/(guest)/home')} />
        {renderList()}
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.xl },
  list: { gap: sawaaSpacing.md },
  body: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  requestState: { alignItems: 'center', justifyContent: 'center', gap: sawaaSpacing.sm, padding: sawaaSpacing.md },
  retryButton: { minHeight: 44, paddingHorizontal: sawaaSpacing.lg, justifyContent: 'center' },
  retryText: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, textDecorationLine: 'underline' },
});
