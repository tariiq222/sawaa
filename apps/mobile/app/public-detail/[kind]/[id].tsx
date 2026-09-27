import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { usePackageFamily, useGroupSession, useTherapist, useTherapists, usePublicCatalog } from '@/hooks/queries';
import { useAppSelector } from '@/hooks/use-redux';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { AquaBackground, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { formatHalalas } from '@/lib/package-utils';
import { goBackOrHome, loginRedirectHref } from '@/lib/navigation';
import { getProfileBookingServices } from '@/lib/clinic-profile';
import { BackButton } from '@/components/ui/BackButton';

type PublicKind = 'service' | 'package' | 'program' | 'therapist';

export default function PublicDetailScreen() {
  const { kind, id, clinicId, serviceId } = useLocalSearchParams<{ kind?: string; id?: string; clinicId?: string; serviceId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const font = getFontName(dir.locale, '400');
  const bold = getFontName(dir.locale, '700');
  const NextIcon = dir.isRTL ? ChevronLeft : ChevronRight;
  const valid = kind === 'service' || kind === 'package' || kind === 'program' || kind === 'therapist';
  const type: PublicKind | undefined = valid ? kind : undefined;
  const catalog = usePublicCatalog((type === 'service' || type === 'therapist') && Boolean(id));
  const therapists = useTherapists();
  const family = usePackageFamily(type === 'package' ? id : undefined);
  const program = useGroupSession(type === 'program' ? id : undefined);
  const therapist = useTherapist(type === 'therapist' ? id : undefined);
  const service = catalog.data?.services.find((item) => item.id === id && item.isHidden !== true && item.isActive !== false && item.archivedAt == null);
  const serviceCategory = service && catalog.data?.categories.find((category) => category.id === service.categoryId);
  const item = type === 'service' ? service : type === 'package' ? family.data : type === 'program' ? program.data : therapist.data;
  const loading = type === 'service' ? catalog.isLoading : type === 'package' ? family.isLoading : type === 'program' ? program.isLoading : therapist.isLoading;
  const name = item ? (dir.isRTL ? item.nameAr : item.nameEn ?? item.nameAr) : null;
  const description = type === 'package' && family.data
    ? (dir.isRTL ? family.data.descriptionAr : family.data.descriptionEn ?? family.data.descriptionAr)
    : type === 'program' && program.data
      ? (dir.isRTL ? program.data.publicDescriptionAr : program.data.publicDescriptionEn ?? program.data.publicDescriptionAr)
      : type === 'therapist' && therapist.data
        ? (dir.isRTL ? therapist.data.publicBioAr : therapist.data.publicBioEn ?? therapist.data.publicBioAr)
        : null;
  const matchingTherapists = type === 'service' && service && (!clinicId || serviceCategory?.id === clinicId)
    ? (therapists.data ?? []).filter((person) => person.serviceIds.includes(service.id))
    : [];
  const matchingServices = type === 'therapist' && therapist.data
    ? (catalog.data ? getProfileBookingServices(catalog.data, therapist.data.serviceIds, clinicId, serviceId) : [])
    : [];
  const startBooking = (selectedServiceId: string, employeeId: string) => {
    // Resolve the clinic from the chosen service, including direct clinics whose
    // internal service must travel with the draft without exposing its label.
    const selected = catalog.data?.services.find((entry) => entry.id === selectedServiceId);
    const category = catalog.data?.categories.find((entry) => entry.id === selected?.categoryId);
    const bookingClinicId = clinicId ?? (category && (category.kind ?? 'CLINIC') === 'CLINIC' ? category.id : undefined);
    router.push({
      pathname: signedIn ? '/(client)/booking/[serviceId]' : '/public-booking/[serviceId]',
      params: { serviceId: selectedServiceId, employeeId, ...(bookingClinicId ? { clinicId: bookingClinicId } : {}) },
    });
  };

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: insets.bottom + sawaaSpacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <BackButton onPress={() => goBackOrHome(router)} style={{ alignSelf: dir.alignStart }} />
        {loading ? <ActivityIndicator color={colors.teal[700]} /> : null}
        {!loading && !item ? <Text style={[styles.body, { fontFamily: font }]}>{t('guest.loadError')}</Text> : null}
        {item ? (
          <Glass variant="strong" style={styles.card}>
            <Text accessibilityRole="header" style={[styles.title, { fontFamily: bold, textAlign: dir.textAlign }]}>{name}</Text>
            {description ? <Text style={[styles.body, { fontFamily: font, textAlign: dir.textAlign }]}>{description}</Text> : null}
            {program.data && type === 'program' ? <Text style={[styles.body, { fontFamily: font }]}>{formatHalalas(Number(program.data.price), dir.locale)}</Text> : null}
            {family.data && type === 'package' ? family.data.options.map((option) => (
              <Text key={option.id} style={[styles.body, { fontFamily: font, textAlign: dir.textAlign }]}>
                {dir.isRTL ? option.nameAr : option.nameEn ?? option.nameAr} · {formatHalalas(option.price.finalPrice, dir.locale)}
              </Text>
            )) : null}
            {therapist.data && type === 'therapist' ? <Text style={[styles.body, { fontFamily: font }]}>{dir.isRTL ? therapist.data.specialtyAr : therapist.data.specialty}</Text> : null}
          </Glass>
        ) : null}
        {type === 'service' && service ? (
          <View style={styles.choices}>
            <Text style={[styles.choiceTitle, { fontFamily: bold, textAlign: dir.textAlign }]}>{t('guest.chooseTherapist')}</Text>
            {therapists.isLoading ? <ActivityIndicator size="small" color={colors.teal[700]} /> : null}
            {matchingTherapists.map((person) => (
              <Glass variant="strong" radius={20}
                key={person.id}
                accessibilityRole="button"
                onPress={() => startBooking(service.id, person.id)}
                style={[styles.practitionerRow, { flexDirection: dir.row }]}
              >
                <Text style={[styles.practitionerName, { fontFamily: bold, textAlign: dir.textAlign }]}>
                  {dir.isRTL ? person.nameAr : person.nameEn ?? person.nameAr}
                </Text>
                <NextIcon size={18} color={colors.teal[700]} strokeWidth={1.75} />
              </Glass>
            ))}
            {!therapists.isLoading && matchingTherapists.length === 0 ? <Text style={styles.body}>{t('guest.empty')}</Text> : null}
          </View>
        ) : null}
        {type === 'therapist' && therapist.data ? (
          <View style={styles.choices}>
            <Text style={[styles.body, { fontFamily: bold, textAlign: dir.textAlign }]}>{t('guest.chooseClinicOrService')}</Text>
            {matchingServices.map((entry) => (
              <Glass key={entry.id} interactive radius={18} onPress={() => startBooking(entry.id, therapist.data!.id)} style={[styles.serviceChoice, { flexDirection: dir.row }]}>
                <Text style={[styles.practitionerName, { fontFamily: bold, textAlign: dir.textAlign }]}>{(() => {
                  const category = catalog.data?.categories.find((item) => item.id === entry.categoryId);
                  return category?.bookingMode === 'DIRECT'
                    ? (dir.isRTL ? category.nameAr : category.nameEn ?? category.nameAr)
                    : (dir.isRTL ? entry.nameAr : entry.nameEn ?? entry.nameAr);
                })()}</Text>
                <NextIcon size={18} color={colors.teal[700]} />
              </Glass>
            ))}
            {!catalog.isLoading && matchingServices.length === 0 ? <Text style={styles.body}>{t('guest.empty')}</Text> : null}
          </View>
        ) : null}
        {type === 'package' || type === 'program' ? (
          <>
            <Text style={[styles.body, { fontFamily: font, textAlign: dir.textAlign }]}>{t('guest.signInToBook')}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push(loginRedirectHref(
              ['(client)', type === 'package' ? 'packages' : 'groups', '[id]'], { id },
            ))} style={styles.login}>
              <Text style={[styles.loginText, { fontFamily: bold }]}>{t('auth.login')}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.md },
  card: { padding: sawaaSpacing.md, borderRadius: sawaaRadius.xl, gap: sawaaSpacing.sm },
  title: { fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight, color: colors.ink[900] },
  body: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[500] },
  price: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight, color: colors.teal[700] },
  choiceTitle: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[900] },
  practitionerRow: {
    minHeight: 56,
    paddingHorizontal: sawaaSpacing.md,
    paddingVertical: sawaaSpacing.sm,
    borderRadius: sawaaRadius.lg,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sawaaSpacing.sm,
  },
  practitionerName: { flex: 1, fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.teal[700] },
  login: { minHeight: 48, borderRadius: sawaaRadius.lg, backgroundColor: colors.teal[700], alignItems: 'center', justifyContent: 'center' },
  loginText: { color: colors.glass.opaqueBg, fontSize: sawaaType.body.fontSize },
  serviceChoice: { minHeight: 54, padding: 14, alignItems: 'center', gap: 10 },
  choices: { gap: sawaaSpacing.sm },
});
