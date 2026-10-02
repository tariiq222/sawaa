import React from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { TherapistCard } from '@/components/features/directory/TherapistCard';
import { TherapistProfileView } from '@/components/features/directory/TherapistProfileView';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { usePackageFamily, useGroupSession, useTherapist, useTherapists, usePublicCatalog } from '@/hooks/queries';
import { useAppSelector } from '@/hooks/use-redux';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { AquaBackground } from '@/theme/sawaa';
import { PrimaryButton } from '@/theme/sawaa/PrimaryButton';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { Glass } from '@/theme/components/Glass';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { formatHalalas } from '@/lib/package-utils';
import { packageGrossHalalas, packageVatRate } from '@/lib/package-vat';
import { goBackOrHome, loginRedirectHref } from '@/lib/navigation';

type PublicKind = 'service' | 'package' | 'program' | 'therapist';

export default function PublicDetailScreen() {
  const { kind, id, clinicId, serviceId } = useLocalSearchParams<{ kind?: string; id?: string; clinicId?: string; serviceId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const insets = useSafeAreaInsets();
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const font = getFontName(dir.locale, '400');
  const bold = getFontName(dir.locale, '700');
  const valid = kind === 'service' || kind === 'package' || kind === 'program' || kind === 'therapist';
  const type: PublicKind | undefined = valid ? kind : undefined;
  const catalog = usePublicCatalog((type === 'service' || type === 'therapist') && Boolean(id));
  const therapists = useTherapists();
  const family = usePackageFamily(type === 'package' ? id : undefined);
  const program = useGroupSession(type === 'program' ? id : undefined);
  const therapist = useTherapist(type === 'therapist' ? id : undefined);
  const service = catalog.data?.services.find((item) => item.id === id && item.isHidden !== true && item.isActive !== false && item.archivedAt == null);
  const serviceCategory = service && catalog.data?.categories.find((category) => category.id === service.categoryId);
  const back = () => goBackOrHome(router);

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

  if (type === 'therapist') {
    return (
      <AquaBackground>
        <TherapistProfileView
          employee={therapist.data}
          loading={therapist.isLoading}
          catalog={catalog.data}
          catalogLoading={catalog.isLoading}
          clinicId={clinicId}
          serviceId={serviceId}
          onBack={back}
          onBook={startBooking}
        />
      </AquaBackground>
    );
  }

  const item = type === 'service' ? service : type === 'package' ? family.data : type === 'program' ? program.data : undefined;
  const loading = type === 'service' ? catalog.isLoading : type === 'package' ? family.isLoading : type === 'program' ? program.isLoading : false;
  const name = item ? (dir.isRTL ? item.nameAr : item.nameEn ?? item.nameAr) : null;
  const description = type === 'package' && family.data
    ? (dir.isRTL ? family.data.descriptionAr : family.data.descriptionEn ?? family.data.descriptionAr)
    : type === 'program' && program.data
      ? (dir.isRTL ? program.data.publicDescriptionAr : program.data.publicDescriptionEn ?? program.data.publicDescriptionAr)
      : type === 'service' && service
        ? (dir.isRTL ? service.descriptionAr : service.descriptionEn ?? service.descriptionAr)
        : null;
  const matchingTherapists = type === 'service' && service && (!clinicId || serviceCategory?.id === clinicId)
    ? (therapists.data ?? []).filter((person) => person.serviceIds.includes(service.id))
    : [];
  const text = [styles.body, { color: colors.ink[500], fontFamily: font, textAlign: dir.textAlign }];
  const heading = [styles.choiceTitle, { color: colors.ink[900], fontFamily: bold, textAlign: dir.textAlign }];

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + sawaaSpacing['3xl'] }]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={name ?? ''} onBack={back} />
        {loading ? <ActivityIndicator color={colors.teal[700]} /> : null}
        {!loading && !item ? <Text style={text}>{t('guest.loadError')}</Text> : null}
        {item ? (
          <Glass radius={sawaaRadius.xl} style={styles.card}>
            <Text style={[styles.title, { color: colors.ink[900], fontFamily: bold, textAlign: dir.textAlign }]}>{name}</Text>
            {description ? <Text style={text}>{description}</Text> : null}
            {program.data && type === 'program' ? (
              <Text style={[styles.price, { color: colors.teal[700], fontFamily: bold, textAlign: dir.textAlign }]}>{formatHalalas(Number(program.data.price), dir.locale)}</Text>
            ) : null}
            {family.data && type === 'package' ? family.data.options.map((option) => (
              <Text key={option.id} style={text}>
                {dir.isRTL ? option.nameAr : option.nameEn ?? option.nameAr} · {formatHalalas(packageGrossHalalas(option.price.finalPrice, packageVatRate(family.data)), dir.locale)}
              </Text>
            )) : null}
            {family.data && type === 'package' && packageVatRate(family.data) > 0 ? (
              <Text style={text}>{t('packages.vatIncluded')}</Text>
            ) : null}
          </Glass>
        ) : null}
        {type === 'service' && service ? (
          <View style={styles.choices}>
            <Text style={heading}>{t('guest.chooseTherapist')}</Text>
            {therapists.isLoading ? <ActivityIndicator size="small" color={colors.teal[700]} /> : null}
            {matchingTherapists.map((person) => (
              <TherapistCard key={person.id} item={person} compact onPress={() => startBooking(service.id, person.id)} />
            ))}
            {!therapists.isLoading && matchingTherapists.length === 0 ? <Text style={text}>{t('guest.empty')}</Text> : null}
          </View>
        ) : null}
        {type === 'package' || type === 'program' ? (
          <View style={styles.choices}>
            <Text style={text}>{t('guest.signInToBook')}</Text>
            <PrimaryButton
              label={t('auth.login')}
              fontFamily={bold}
              onPress={() => router.push(loginRedirectHref(
                ['(client)', type === 'package' ? 'packages' : 'groups', '[id]'], { id },
              ))}
            />
          </View>
        ) : null}
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  card: { padding: sawaaSpacing.lg, gap: sawaaSpacing.sm },
  title: { fontSize: sawaaType.heading.fontSize - 4, lineHeight: sawaaType.heading.lineHeight },
  body: { fontSize: sawaaType.body.fontSize + 1, lineHeight: 22 },
  price: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  choiceTitle: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  choices: { gap: sawaaSpacing.md },
});
