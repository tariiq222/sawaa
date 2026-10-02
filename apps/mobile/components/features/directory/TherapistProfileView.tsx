import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarPlus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { FloatingCta } from '@/components/ui/FloatingCta';
import { GlassSegmented } from '@/components/ui/GlassSegmented';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useDir } from '@/hooks/useDir';
import { getProfileBookingGroups, getProfileBookingServices } from '@/lib/clinic-profile';
import type { PublicCatalogRaw, PublicService } from '@/services/client/catalog';
import type { PublicEmployeeItem } from '@/services/client/employees';
import { getFontName } from '@/theme/fonts';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { getSawaaRoles, sawaaSpacing } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';

import { ProfileHero } from './ProfileHero';
import { ServiceRow } from './ServiceRow';
import { therapistDisplay } from './TherapistCard';

type ProfileTab = 'about' | 'services';

interface TherapistProfileViewProps {
  employee: PublicEmployeeItem | undefined;
  loading: boolean;
  catalog: PublicCatalogRaw | undefined;
  catalogLoading: boolean;
  /** Scope carried from clinic discovery; never widened here (see the clinic/service contract). */
  clinicId?: string;
  serviceId?: string;
  onBack: () => void;
  /** Starts booking for the chosen service. Client and guest pass their own route. */
  onBook: (serviceId: string, employeeId: string) => void;
}

/**
 * Practitioner profile shared by the client route and the guest (public-detail)
 * route, so both look and behave the same: hero card, about / services tabs and
 * a floating «احجز موعدًا» action. The availability tab in the canvas has no
 * data source here (slots need a service, branch and date), so it is omitted.
 */
export function TherapistProfileView({
  employee, loading, catalog, catalogLoading, clinicId, serviceId, onBack, onBook,
}: TherapistProfileViewProps) {
  const { t } = useTranslation();
  const colors = useSawaaColors();
  const { scheme } = useTheme();
  const dir = useDir();
  const insets = useSafeAreaInsets();
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');
  const [tab, setTab] = useState<ProfileTab | null>(null);
  const [chosenServiceId, setChosenServiceId] = useState<string | null>(null);

  const display = employee ? therapistDisplay(employee, dir.isRTL, t('therapists.unknownName')) : null;
  const bio = employee
    ? (dir.isRTL ? employee.publicBioAr : employee.publicBioEn) ?? employee.publicBioEn ?? employee.publicBioAr
    : null;
  const services = useMemo<PublicService[]>(
    () => (catalog && employee ? getProfileBookingServices(catalog, employee.serviceIds, clinicId, serviceId) : []),
    [catalog, employee, clinicId, serviceId],
  );
  const { clinics, serviceGroups } = useMemo(
    () => (catalog ? getProfileBookingGroups(catalog, services) : { clinics: [], serviceGroups: [] }),
    [catalog, services],
  );
  const selectedServiceId = services.some((service) => service.id === chosenServiceId)
    ? chosenServiceId
    : services.length === 1 ? services[0].id : null;
  const bookable = Boolean(employee?.isBookable) && services.length > 0;
  const needsChoice = bookable && !selectedServiceId;
  // Open on services when a choice is required (or there is no bio to read).
  const activeTab: ProfileTab = tab ?? (needsChoice || !bio ? 'services' : 'about');

  const nameOf = (nameAr: string, nameEn: string | null) => (dir.isRTL ? nameAr : nameEn) ?? nameAr;
  const clinicNames = clinics.map(({ category }) => nameOf(category.nameAr, category.nameEn));
  const rating = employee && typeof employee.ratingAverage === 'number' && (employee.ratingCount ?? 0) > 0
    ? {
      value: employee.ratingAverage.toLocaleString(dir.isRTL ? 'ar-SA' : 'en-US', { maximumFractionDigits: 1 }),
      caption: t('employeeProfile.ratingCount', { count: employee.ratingCount }),
    }
    : null;

  const serviceRow = (service: PublicService, title?: string) => (
    <ServiceRow
      key={service.id}
      mode="radio"
      title={title ?? nameOf(service.nameAr, service.nameEn)}
      subtitle={(dir.isRTL ? service.descriptionAr : service.descriptionEn ?? service.descriptionAr) ?? null}
      selected={service.id === selectedServiceId}
      onPress={() => {
        setChosenServiceId(service.id);
        // Keep the list on screen: once a row is chosen the default tab would flip to About.
        setTab((current) => current ?? 'services');
      }}
      testID={`employee-service-${service.id}`}
    />
  );

  const groupLabel = (label: string) => (
    <Text accessibilityRole="header" style={[styles.groupLabel, { color: colors.ink[700], fontFamily: f700, textAlign: dir.textAlign }]}>{label}</Text>
  );

  const servicesTab = (
    <View style={styles.section}>
      {clinics.length > 0 ? (
        <View style={styles.group}>
          <SectionHeader title={t('employeeProfile.clinics')} />
          {clinics.map(({ category, bookingMode, directServiceId, services: clinicServices }) => {
            const name = nameOf(category.nameAr, category.nameEn);
            if (bookingMode === 'DIRECT') {
              // The hidden internal service travels with the booking but never appears as a service.
              const internal = clinicServices.find((service) => service.id === directServiceId);
              return internal ? <View key={category.id} testID={`employee-clinic-${category.id}`}>{serviceRow(internal, name)}</View> : null;
            }
            return (
              <View key={category.id} testID={`employee-clinic-${category.id}`} style={styles.group}>
                {groupLabel(name)}
                {clinicServices.map((service) => serviceRow(service))}
              </View>
            );
          })}
        </View>
      ) : null}
      {serviceGroups.length > 0 ? (
        <View style={styles.group}>
          {/* The tab already says «الخدمات»; only repeat it to separate these from the clinics above. */}
          {clinics.length > 0 ? <SectionHeader title={t('employeeProfile.services')} /> : null}
          {serviceGroups.map(({ category, services: groupServices }) => (
            <View key={category?.id ?? 'uncategorized'} style={styles.group}>
              {category ? groupLabel(nameOf(category.nameAr, category.nameEn)) : null}
              {groupServices.map((service) => serviceRow(service))}
            </View>
          ))}
        </View>
      ) : null}
      {services.length === 0 ? (
        <Text style={[styles.body, { color: colors.ink[500], fontFamily: f400, textAlign: dir.textAlign }]}>
          {loading || catalogLoading ? t('therapists.loading') : t('employeeProfile.noServices')}
        </Text>
      ) : null}
    </View>
  );

  const hint = !employee?.isBookable
    ? t('employeeProfile.unavailable')
    : needsChoice ? t('employeeProfile.selectBookingOption') : bookable ? t('employeeProfile.priceAtNextStep') : null;

  const onCta = () => {
    if (!bookable || !employee) return;
    if (!selectedServiceId) return;
    onBook(selectedServiceId, employee.id);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 180 }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={t('employeeProfile.profileTitle')} onBack={onBack} />
        {employee && display ? (
          <>
            <ProfileHero
              name={display.name}
              lines={[display.subtitle, clinicNames.join(' · ')].filter((line): line is string => Boolean(line))}
              imageUri={employee.publicImageUrl}
              pills={employee.isAvailableToday ? [{ label: t('therapists.availableToday') }] : []}
              rating={rating}
            />
            <GlassSegmented
              options={[
                { value: 'about', label: t('employeeProfile.about') },
                { value: 'services', label: t('employeeProfile.services') },
              ] as const}
              value={activeTab}
              onChange={setTab}
            />
            {activeTab === 'about' ? (
              <Text style={[styles.about, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>
                {bio ?? t('employeeProfile.noBio')}
              </Text>
            ) : servicesTab}
          </>
        ) : (
          <Text style={[styles.body, { color: colors.ink[500], fontFamily: f400, textAlign: dir.textAlign }]}>
            {loading ? t('therapists.loading') : t('guest.loadError')}
          </Text>
        )}
      </ScrollView>
      {employee ? (
        <FloatingCta>
          {hint ? <Text style={[styles.hint, { color: colors.ink[700], fontFamily: f400 }]}>{hint}</Text> : null}
          <PrimaryButton
            label={needsChoice ? t('employeeProfile.chooseToContinue') : t('employeeProfile.bookAppointment')}
            fontFamily={f700}
            icon={<CalendarPlus size={22} color={getSawaaRoles(scheme).action.foreground} strokeWidth={1.75} />}
            disabled={!bookable || needsChoice}
            onPress={onCta}
          />
        </FloatingCta>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.xl },
  section: { gap: sawaaSpacing.xl },
  group: { gap: sawaaSpacing.md },
  groupLabel: { fontSize: 15, lineHeight: 22 },
  about: { fontSize: 15, lineHeight: 26 },
  body: { fontSize: 15, lineHeight: 22 },
  hint: { fontSize: 13, textAlign: 'center' },
});
