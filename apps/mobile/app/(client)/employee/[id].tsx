import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AquaBackground, sawaaRadius } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Glass } from '@/theme/components/Glass';
import { BackButton } from '@/components/ui/BackButton';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { usePublicCatalog, useTherapist } from '@/hooks/queries';
import { getProfileBookingGroups, getProfileBookingServices } from '@/lib/clinic-profile';

export default function EmployeeProfileScreen() {
  const { id, clinicId, serviceId } = useLocalSearchParams<{ id: string; clinicId?: string; serviceId?: string }>();
  const { t } = useTranslation();
  const colors = useSawaaColors();
  const styles = createStyles(colors);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;
  const { data: employee, isLoading: employeeLoading } = useTherapist(id);
  const { data: catalog, isLoading: catalogLoading } = usePublicCatalog();
  const [chosenServiceId, setChosenServiceId] = useState<string | null>(null);

  const employeeName = employee
    ? (dir.isRTL ? employee.nameAr : employee.nameEn) ?? employee.nameEn ?? employee.nameAr ?? t('therapists.unknownName')
    : t('therapists.unknownName');
  const employeeSpec = employee
    ? [(dir.isRTL ? employee.specialtyAr : employee.specialty) ?? employee.specialty ?? employee.specialtyAr, employee.title]
      .filter(Boolean).join(' · ')
    : '';
  const employeeBio = employee
    ? (dir.isRTL ? employee.publicBioAr : employee.publicBioEn) ?? employee.publicBioEn ?? employee.publicBioAr
    : null;
  const services = catalog && employee
    ? getProfileBookingServices(catalog, employee.serviceIds, clinicId, serviceId)
    : [];
  const { clinics, serviceGroups } = catalog
    ? getProfileBookingGroups(catalog, services)
    : { clinics: [], serviceGroups: [] };
  const selectedServiceId = services.some((service) => service.id === chosenServiceId)
    ? chosenServiceId
    : services.length === 1 ? services[0].id : null;
  const canBook = Boolean(employee?.isBookable && selectedServiceId);
  const rating = employee?.ratingAverage;
  const ratingCount = employee?.ratingCount ?? 0;
  const numberLocale = dir.isRTL ? 'ar-SA' : 'en-US';

  const book = () => {
    if (!employee?.isBookable || !selectedServiceId) return;
    const selectedService = services.find((service) => service.id === selectedServiceId);
    const selectedClinic = catalog?.categories.find((category) =>
      category.id === selectedService?.categoryId &&
      (category.kind ?? 'CLINIC') === 'CLINIC' && category.isActive !== false && category.archivedAt == null,
    );
    const bookingClinicId = clinicId ?? selectedClinic?.id;
    router.push({
      pathname: '/(client)/booking/[serviceId]',
      params: { serviceId: selectedServiceId, employeeId: employee.id, ...(bookingClinicId ? { clinicId: bookingClinicId } : {}) },
    });
  };

  const serviceOption = (service: typeof services[number], name?: string) => {
    const selected = service.id === selectedServiceId;
    return (
      <Glass key={service.id} onPress={() => setChosenServiceId(service.id)}
        variant={selected ? 'strong' : 'regular'} radius={sawaaRadius.md}
        accessibilityRole="radio" accessibilityState={{ selected }}
        testID={`employee-service-${service.id}`}
        style={[styles.serviceOption, selected && styles.serviceSelected]}>
        <Text style={[styles.serviceName, { fontFamily: selected ? f700 : f600, textAlign: dir.textAlign }]}>
          {name ?? (dir.isRTL ? service.nameAr : service.nameEn) ?? service.nameAr}
        </Text>
      </Glass>
    );
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(500)}>
          <BackButton onPress={() => router.back()} style={{ alignSelf: dir.alignStart }} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.heroCard}>
            <View style={[styles.heroRow, { flexDirection: dir.row }]}>
              {employee?.publicImageUrl ? (
                <Image
                  source={{ uri: employee.publicImageUrl }}
                  style={styles.avatar}
                  accessibilityLabel={employeeName}
                />
              ) : (
                <LinearGradient colors={[colors.teal[100], colors.teal[300]]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                  <Text style={[styles.avatarText, { fontFamily: f700 }]}>{employeeName.charAt(0)}</Text>
                </LinearGradient>
              )}
              <View style={styles.heroMid}>
                <Text style={[styles.heroName, { fontFamily: f700, textAlign: dir.textAlign }]}>{employeeName}</Text>
                {employeeSpec ? (
                  <Text style={[styles.heroSpec, { fontFamily: f400, textAlign: dir.textAlign }]}>{employeeSpec}</Text>
                ) : null}
                {typeof rating === 'number' && ratingCount > 0 ? (
                  <View style={[styles.rating, { flexDirection: dir.row }]}>
                    <Star size={11} color={colors.accent.amber} strokeWidth={2} fill={colors.accent.amber} />
                    <Text style={[styles.ratingVal, { fontFamily: f700 }]}>{rating.toLocaleString(numberLocale, { maximumFractionDigits: 1 })}</Text>
                    <Text style={[styles.ratingCount, { fontFamily: f400 }]}>
                      {t('employeeProfile.ratingCount', { count: ratingCount })}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </Glass>
        </Animated.View>

        {employeeBio ? (
          <Animated.View entering={FadeInDown.delay(180).duration(700).easing(Easing.out(Easing.cubic))}>
            <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>{t('employeeProfile.about')}</Text>
            <Text style={[styles.aboutText, { fontFamily: f400, textAlign: dir.textAlign }]}>{employeeBio}</Text>
          </Animated.View>
        ) : null}

        <Animated.View style={styles.services} entering={FadeInDown.delay(260).duration(700).easing(Easing.out(Easing.cubic))}>
          {clinics.length > 0 ? (
            <View style={styles.services}>
              <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>{t('employeeProfile.clinics')}</Text>
              {clinics.map(({ category, bookingMode, directServiceId, services: clinicServices }) => {
                const name = (dir.isRTL ? category.nameAr : category.nameEn) ?? category.nameAr;
                if (bookingMode === 'DIRECT') {
                  const internalService = clinicServices.find((service) => service.id === directServiceId);
                  return internalService ? serviceOption(internalService, name) : null;
                }
                return (
                  <Glass key={category.id} testID={`employee-clinic-${category.id}`} variant="regular" radius={sawaaRadius.lg} style={styles.clinicGroup}>
                    <Text accessibilityRole="header" style={[styles.clinicName, { fontFamily: f700, textAlign: dir.textAlign }]}>{name}</Text>
                    {clinicServices.map((service) => serviceOption(service))}
                  </Glass>
                );
              })}
            </View>
          ) : null}
          {serviceGroups.length > 0 ? (
            <View style={styles.services}>
              <Text style={[styles.sectionTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>{t('employeeProfile.services')}</Text>
              {serviceGroups.map(({ category, services: groupServices }) => (
                <View key={category?.id ?? 'uncategorized'} style={styles.services}>
                  {category ? <Text accessibilityRole="header" style={[styles.clinicName, { fontFamily: f600, textAlign: dir.textAlign }]}>
                    {(dir.isRTL ? category.nameAr : category.nameEn) ?? category.nameAr}
                  </Text> : null}
                  {groupServices.map((service) => serviceOption(service))}
                </View>
              ))}
            </View>
          ) : null}
          {services.length === 0 ? (
            <Text style={[styles.emptyText, { fontFamily: f400, textAlign: dir.textAlign }]}>
              {employeeLoading || catalogLoading ? t('therapists.loading') : t('employeeProfile.noServices')}
            </Text>
          ) : null}
        </Animated.View>
      </ScrollView>

      <Animated.View entering={FadeInDown.delay(340).duration(800).easing(Easing.out(Easing.cubic))}
        style={[styles.ctaWrap, { bottom: insets.bottom + 20 }]}>
        <Glass variant="strong" radius={sawaaRadius.pill} style={styles.ctaPill}>
          <View style={[styles.ctaRow, { flexDirection: dir.row }]}>
            <Text style={[styles.ctaHint, { fontFamily: f400 }]}>
              {canBook ? t('employeeProfile.priceAtNextStep') : services.length > 1 && employee?.isBookable
                ? t('employeeProfile.selectBookingOption') : t('employeeProfile.unavailable')}
            </Text>
            <Pressable onPress={book} disabled={!canBook} accessibilityRole="button"
              accessibilityState={{ disabled: !canBook }} style={[styles.ctaBtnPress, !canBook && styles.ctaDisabled]}>
              <LinearGradient colors={[colors.teal[500], colors.teal[700]]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ctaBtn}>
                <Text style={[styles.ctaBtnText, { fontFamily: f700 }]}>{t('employeeProfile.bookNow')}</Text>
                <GoIcon size={14} color={colors.teal[50]} strokeWidth={2} />
              </LinearGradient>
            </Pressable>
          </View>
        </Glass>
      </Animated.View>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 18 },
  heroCard: { padding: 18 },
  heroRow: { alignItems: 'center', gap: 14 },
  avatar: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 32, color: colors.teal[50] },
  heroMid: { flex: 1 },
  heroName: { fontSize: 17, color: colors.ink[900] },
  heroSpec: { fontSize: 12, color: colors.ink[500], marginTop: 2 },
  rating: { alignItems: 'center', gap: 4, marginTop: 6 },
  ratingVal: { fontSize: 11, color: colors.ink[900] },
  ratingCount: { fontSize: 11, color: colors.ink[500] },
  sectionTitle: { fontSize: 14, color: colors.ink[900], marginBottom: 8 },
  aboutText: { fontSize: 12.5, color: colors.ink[700], lineHeight: 22 },
  services: { gap: 8 },
  clinicGroup: { gap: 8, padding: 12 },
  clinicName: { fontSize: 14, color: colors.ink[900], marginBottom: 2 },
  serviceOption: { padding: 12 },
  serviceSelected: { borderColor: colors.teal[600], borderWidth: 2 },
  serviceName: { fontSize: 13, color: colors.ink[900] },
  emptyText: { fontSize: 12, color: colors.ink[500] },
  ctaWrap: { position: 'absolute', left: 16, right: 16 },
  ctaPill: { padding: 6 },
  ctaRow: { alignItems: 'center', gap: 8, minHeight: 46 },
  ctaHint: { flex: 1, paddingHorizontal: 12, fontSize: 10, color: colors.ink[500] },
  ctaBtnPress: { height: 46 },
  ctaDisabled: { opacity: 0.45 },
  ctaBtn: { paddingHorizontal: 20, borderRadius: 999, height: 46, flexDirection: 'row', alignItems: 'center', gap: 6 },
  ctaBtnText: { color: colors.teal[50], fontSize: 13 },
});
