import React, { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { usePackageFamily, useGroupSession, useTherapist, useTherapists, usePublicCatalog } from '@/hooks/queries';
import { useAppSelector } from '@/hooks/use-redux';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { AquaBackground } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { formatHalalas } from '@/lib/package-utils';

type PublicKind = 'service' | 'package' | 'program' | 'therapist';

export default function PublicDetailScreen() {
  const { kind, id } = useLocalSearchParams<{ kind?: string; id?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const service = catalog.data?.services.find((item) => item.id === id);
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
  const matchingTherapists = type === 'service' && service
    ? (therapists.data ?? []).filter((person) => person.serviceIds.includes(service.id))
    : [];
  const matchingServices = type === 'therapist' && therapist.data
    ? (catalog.data?.services ?? []).filter((entry) => therapist.data?.serviceIds.includes(entry.id))
    : [];
  const startBooking = (serviceId: string, employeeId: string) => router.push({
    pathname: signedIn ? '/(client)/booking/[serviceId]' : '/public-booking/[serviceId]',
    params: { serviceId, employeeId },
  });

  return (
    <AquaBackground>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }]}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.action}>
          <Text style={[styles.link, { fontFamily: bold }]}>{t('a11y.buttonBack')}</Text>
        </Pressable>
        {loading ? <ActivityIndicator color={colors.teal[700]} /> : null}
        {!loading && !item ? <Text style={[styles.body, { fontFamily: font }]}>{t('guest.loadError')}</Text> : null}
        {item ? (
          <View style={styles.card}>
            <Text accessibilityRole="header" style={[styles.title, { fontFamily: bold, textAlign: dir.textAlign }]}>{name}</Text>
            {description ? <Text style={[styles.body, { fontFamily: font, textAlign: dir.textAlign }]}>{description}</Text> : null}
            {service ? <Text style={[styles.body, { fontFamily: font }]}>{formatHalalas(Number(service.price), dir.locale)}</Text> : null}
            {program.data && type === 'program' ? <Text style={[styles.body, { fontFamily: font }]}>{formatHalalas(Number(program.data.price), dir.locale)}</Text> : null}
            {family.data && type === 'package' ? family.data.options.map((option) => (
              <Text key={option.id} style={[styles.body, { fontFamily: font, textAlign: dir.textAlign }]}>
                {dir.isRTL ? option.nameAr : option.nameEn ?? option.nameAr} · {formatHalalas(option.price.finalPrice, dir.locale)}
              </Text>
            )) : null}
            {therapist.data && type === 'therapist' ? <Text style={[styles.body, { fontFamily: font }]}>{dir.isRTL ? therapist.data.specialtyAr : therapist.data.specialty}</Text> : null}
          </View>
        ) : null}
        {type === 'service' && service ? (
          <View style={styles.choices}>
            <Text style={[styles.body, { fontFamily: bold, textAlign: dir.textAlign }]}>{t('guest.chooseTherapist')}</Text>
            {matchingTherapists.map((person) => (
              <Pressable key={person.id} accessibilityRole="button" onPress={() => startBooking(service.id, person.id)} style={styles.login}>
                <Text style={[styles.loginText, { fontFamily: bold }]}>{dir.isRTL ? person.nameAr : person.nameEn ?? person.nameAr}</Text>
              </Pressable>
            ))}
            {!therapists.isLoading && matchingTherapists.length === 0 ? <Text style={styles.body}>{t('guest.empty')}</Text> : null}
          </View>
        ) : null}
        {type === 'therapist' && therapist.data ? (
          <View style={styles.choices}>
            <Text style={[styles.body, { fontFamily: bold, textAlign: dir.textAlign }]}>{t('guest.chooseService')}</Text>
            {matchingServices.map((entry) => (
              <Pressable key={entry.id} accessibilityRole="button" onPress={() => startBooking(entry.id, therapist.data!.id)} style={styles.login}>
                <Text style={[styles.loginText, { fontFamily: bold }]}>{dir.isRTL ? entry.nameAr : entry.nameEn ?? entry.nameAr}</Text>
              </Pressable>
            ))}
            {!catalog.isLoading && matchingServices.length === 0 ? <Text style={styles.body}>{t('guest.empty')}</Text> : null}
          </View>
        ) : null}
        {type === 'package' || type === 'program' ? (
          <>
            <Text style={[styles.body, { fontFamily: font, textAlign: dir.textAlign }]}>{t('guest.signInToBook')}</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/(auth)/login')} style={styles.login}>
              <Text style={[styles.loginText, { fontFamily: bold }]}>{t('auth.login')}</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  content: { paddingHorizontal: 20, gap: 16 },
  card: { padding: 20, borderRadius: 18, backgroundColor: colors.glass.opaqueBg, gap: 12 },
  title: { fontSize: 25, color: colors.ink[900] },
  body: { fontSize: 15, lineHeight: 25, color: colors.ink[500] },
  action: { minHeight: 44, justifyContent: 'center' },
  link: { color: colors.teal[700] },
  login: { minHeight: 48, borderRadius: 14, backgroundColor: colors.teal[700], alignItems: 'center', justifyContent: 'center' },
  loginText: { color: colors.glass.opaqueBg, fontSize: 16 },
  choices: { gap: 12 },
});
