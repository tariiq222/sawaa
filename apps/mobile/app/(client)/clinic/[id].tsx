import React, { useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AquaBackground, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useClinics, usePublicCatalog, useTherapists } from '@/hooks/queries';
import { getCategoryBookingServices } from '@sawaa/shared/catalog';
import { useAppSelector } from '@/hooks/use-redux';

const HERO_HEIGHT = 200;

export default function ClinicDetailScreen() {
  const colors = useSawaaColors();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f500 = getFontName(dir.locale, '500');
  const f700 = getFontName(dir.locale, '700');
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;

  // The clinic directory is derived from the public catalog + bookable
  // therapists; this route renders one entry of that same list.
  const clinicsQuery = useClinics();
  const catalogQuery = usePublicCatalog();
  const therapistsQuery = useTherapists();
  const clinic = useMemo(
    () => (clinicsQuery.data ?? []).find((entry) => entry.id === id),
    [clinicsQuery.data, id],
  );

  const clinicName = clinic
    ? (dir.isRTL ? clinic.nameAr : (clinic.nameEn ?? clinic.nameAr))
    : '';
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
  const requestState = (loading: boolean, failed: boolean, emptyLabel: string, retry: () => unknown) => {
    if (loading) {
      return <View style={[styles.requestState, { flexDirection: dir.row }]}><ActivityIndicator color={colors.teal[700]} /><Text style={styles.clinicMeta}>{t('common.loading')}</Text></View>;
    }
    if (failed) {
      return (
        <View style={styles.requestState}>
          <Text style={[styles.clinicMeta, { textAlign: dir.textAlign }]}>{t('guest.loadError')}</Text>
          <Pressable onPress={() => { void retry(); }} accessibilityRole="button" style={styles.retryButton}>
            <Text style={[styles.retryText, { fontFamily: f500 }]}>{t('common.retry')}</Text>
          </Pressable>
        </View>
      );
    }
    return <Text style={[styles.clinicMeta, { textAlign: dir.textAlign }]}>{emptyLabel}</Text>;
  };

  const renderBody = () => {
    if (clinicsQuery.isLoading) {
      return (
        <View style={styles.stateWrap}>
          <Skeleton height={96} radius={sawaaRadius.xl} />
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
        {/* Info card overlay (name + bookable counts) — sits at the bottom of the hero */}
        <Animated.View entering={FadeInDown.delay(100).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.infoCard}>
            <Text style={[styles.clinicName, { fontFamily: f700, textAlign: dir.textAlign }]}>
              {clinicName}
            </Text>
            <View style={[styles.metaRow, { flexDirection: dir.row }]}>
              <Text style={[styles.clinicMeta, { fontFamily: f500, fontWeight: '500' }]}>
                {t('clinics.therapistsCount', { count: clinic.therapistCount })}
              </Text>
              {clinic.serviceCount > 0 ? <Text style={[styles.clinicMeta, { fontFamily: f500, fontWeight: '500' }]}>
                {t('clinics.servicesCount', { count: clinic.serviceCount })}
              </Text> : null}
            </View>
          </Glass>
        </Animated.View>
        {services.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
              {t('guest.services')}
            </Text>
            {services.map((service) => {
              const serviceName = dir.isRTL ? service.nameAr : service.nameEn ?? service.nameAr;
              return (
                <Glass
                  key={service.id}
                  variant="strong"
                  radius={sawaaRadius.lg}
                  style={styles.serviceCard}
                  onPress={() => router.push({
                    pathname: signedIn ? '/(client)/therapists' : '/public-list/[kind]',
                    params: { ...(!signedIn ? { kind: 'therapists' } : {}), clinicId: clinic.id, serviceId: service.id },
                  })}
                  interactive
                  accessibilityLabel={serviceName}
                >
                  <View style={[styles.catalogRow, { flexDirection: dir.row }]}>
                    <Text style={[styles.serviceName, { fontFamily: f500, textAlign: dir.textAlign, flex: 1 }]}>
                      {serviceName}
                    </Text>
                    <GoIcon size={16} color={colors.ink[500]} strokeWidth={1.75} />
                  </View>
                </Glass>
              );
            })}
          </View>
        ) : null}
        {clinic.bookingMode === 'SERVICES' && services.length === 0 ? requestState(
          catalogQuery.isLoading,
          catalogQuery.isError,
          t('guest.empty'),
          catalogQuery.refetch,
        ) : null}
        {therapists.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
              {t('therapists.title')}
            </Text>
            {therapists.map((therapist) => {
              const name = (dir.isRTL ? therapist.nameAr : therapist.nameEn) ?? therapist.nameEn ?? therapist.nameAr ?? t('therapists.unknownName');
              return (
                <Glass
                  key={therapist.id}
                  variant="strong"
                  radius={sawaaRadius.lg}
                  style={styles.serviceCard}
                  onPress={() => router.push({
                    pathname: signedIn ? '/(client)/employee/[id]' : '/public-detail/[kind]/[id]',
                    params: signedIn
                      ? { id: therapist.slug ?? therapist.id, clinicId: clinic.id }
                      : { kind: 'therapist', id: therapist.slug ?? therapist.id, clinicId: clinic.id },
                  })}
                  interactive
                  accessibilityLabel={name}
                >
                  <View style={[styles.catalogRow, { flexDirection: dir.row }]}>
                    <Text style={[styles.serviceName, { fontFamily: f500, textAlign: dir.textAlign, flex: 1 }]}>{name}</Text>
                    <GoIcon size={16} color={colors.ink[500]} strokeWidth={1.75} />
                  </View>
                </Glass>
              );
            })}
          </View>
        ) : null}
        {therapists.length === 0 ? requestState(
          therapistsQuery.isLoading,
          therapistsQuery.isError,
          t('therapists.empty'),
          therapistsQuery.refetch,
        ) : null}
      </>
    );
  };

  return (
    <AquaBackground>
      {/* Hero region with glass overlay (name + counts) */}
      <LinearGradient
        colors={[colors.teal[300], colors.teal[600], colors.teal[900]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroIcon}>
          <Building2 size={160} color={theme.colors.primaryForeground} opacity={0.28} strokeWidth={1} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button over hero */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <Glass variant="strong" radius={22} onPress={() => router.back()} interactive accessibilityLabel={t('a11y.buttonBack')} style={[styles.backBtn, { alignSelf: dir.alignStart }]}>
            <BackIcon size={22} color={colors.ink[700]} strokeWidth={1.75} />
          </Glass>
        </Animated.View>

        {/* Spacer so content starts below hero (hero is 200, with info card overlapping by ~36) */}
        <View style={{ height: HERO_HEIGHT - 56 - 44 - 12 }} />

        {renderBody()}
      </ScrollView>

    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: HERO_HEIGHT, overflow: 'hidden' },
  heroIcon: { position: 'absolute', bottom: -20, left: 0, right: 0, alignItems: 'center' },
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  stateWrap: { gap: sawaaSpacing.md },
  infoCard: { padding: sawaaSpacing.lg, gap: sawaaSpacing.sm },
  clinicName: { fontSize: 20, color: colors.ink[900] },
  metaRow: { flexWrap: 'wrap', gap: sawaaSpacing.md, alignItems: 'center' },
  clinicMeta: { fontSize: sawaaType.caption.fontSize, color: colors.ink[500] },
  section: { gap: sawaaSpacing.sm },
  sectionTitle: { fontSize: 16, color: colors.ink[900] },
  serviceCard: { paddingVertical: sawaaSpacing.md, paddingHorizontal: sawaaSpacing.lg },
  catalogRow: { alignItems: 'center', gap: sawaaSpacing.md },
  serviceName: { color: colors.ink[900], fontSize: 15 },
  requestState: { alignItems: 'center', justifyContent: 'center', gap: sawaaSpacing.sm, padding: sawaaSpacing.md, backgroundColor: colors.glass.opaqueBg, borderRadius: sawaaRadius.lg },
  retryButton: { minHeight: 40, paddingHorizontal: sawaaSpacing.md, borderRadius: sawaaRadius.pill, backgroundColor: colors.teal[700], alignItems: 'center', justifyContent: 'center' },
  retryText: { color: colors.glass.opaqueBg, fontSize: 13 },
});
