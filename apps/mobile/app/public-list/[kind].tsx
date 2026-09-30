import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useClinics, useTherapists, useGroupSessions, usePackageFamilies } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { AquaBackground } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Glass } from '@/theme/components/Glass';
import { Avatar } from '@/components/ui/Avatar';
import { BackButton } from '@/components/ui/BackButton';
import { useAppSelector } from '@/hooks/use-redux';
import { goBackOrHome } from '@/lib/navigation';

export default function PublicListScreen() {
  const { kind, clinicId, serviceId } = useLocalSearchParams<{ kind?: string; clinicId?: string; serviceId?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isGuest = !useAppSelector((state) => state.auth.token);
  const bold = getFontName(dir.locale, '700');
  const clinics = useClinics();
  const therapists = useTherapists();
  const programs = useGroupSessions();
  const families = usePackageFamilies();
  const selectedClinic = clinics.data?.find((clinic) => clinic.id === clinicId);
  const serviceMatchesClinic = !clinicId || !serviceId || selectedClinic?.serviceIds.includes(serviceId) === true;
  const visibleTherapists = therapists.data?.filter((person) =>
    serviceMatchesClinic
    && (!clinicId || (selectedClinic != null && person.serviceIds.some((id) => selectedClinic.serviceIds.includes(id))))
    && (!serviceId || person.serviceIds.includes(serviceId))) ?? [];
  const entries: Array<{ id: string; kind: string; nameAr: string | null; nameEn: string | null; detail?: string; title?: string | null; bio?: string | null; imageUrl?: string | null }> = kind === 'clinics' ? (clinics.data ?? []).map((item) => ({
    id: item.id,
    kind: 'clinic',
    nameAr: item.nameAr,
    nameEn: item.nameEn ?? null,
    detail: `${t('clinics.therapistsCount', { count: item.therapistCount })} · ${t('clinics.servicesCount', { count: item.serviceCount })}`,
  }))
    : kind === 'therapists' ? visibleTherapists.map((item) => ({ id: item.slug ?? item.id, kind: 'therapist', nameAr: item.nameAr, nameEn: item.nameEn ?? null, title: item.title, imageUrl: item.publicImageUrl, bio: dir.isRTL ? item.publicBioAr : item.publicBioEn ?? item.publicBioAr }))
      : kind === 'packages' ? (families.data ?? []).map((item) => ({ id: item.id, kind: 'package', nameAr: item.nameAr, nameEn: item.nameEn ?? null }))
        : kind === 'programs' ? (programs.data ?? []).map((item) => ({ id: item.id, kind: 'program', nameAr: item.nameAr, nameEn: item.nameEn ?? null })) : [];
  const valid = kind === 'clinics' || kind === 'therapists' || kind === 'packages' || kind === 'programs';
  const loading = kind === 'clinics' ? clinics.isLoading
    : kind === 'therapists' ? therapists.isLoading || Boolean(clinicId && clinics.isLoading)
      : kind === 'packages' ? families.isLoading : programs.isLoading;
  const title = kind === 'clinics' ? t('clinics.title') : kind === 'therapists' ? t('guest.therapists') : kind === 'packages' ? t('guest.packages') : t('guest.programs');

  return (
    <AquaBackground>
      <FlatList
        key={kind === 'therapists' ? 'therapist-grid' : 'list'}
        numColumns={kind === 'therapists' ? 2 : 1}
        columnWrapperStyle={kind === 'therapists' ? [styles.gridRow, { flexDirection: dir.row }] : undefined}
        data={entries}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        ListHeaderComponent={(
          <View style={styles.header}>
            <BackButton onPress={() => goBackOrHome(router)} style={{ alignSelf: dir.alignStart }} />
            <Text accessibilityRole="header" style={[styles.title, { fontFamily: bold, textAlign: dir.textAlign }]}>{title}</Text>
            {valid && loading ? <ActivityIndicator color={colors.teal[700]} /> : null}
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>{t('guest.empty')}</Text> : null}
        renderItem={({ item }) => (
          <Glass variant="strong" radius={20} style={[styles.card, item.kind === 'therapist' && styles.squareCard]}
            onPress={() => item.kind === 'clinic'
              ? router.push({ pathname: isGuest ? '/public-clinic/[id]' : '/(client)/clinic/[id]', params: { id: item.id } })
              : router.push({ pathname: '/public-detail/[kind]/[id]', params: { kind: item.kind, id: item.id, ...(item.kind === 'therapist' && clinicId ? { clinicId } : {}), ...(item.kind === 'therapist' && serviceId ? { serviceId } : {}) } })}
            accessibilityLabel={`${dir.isRTL ? item.nameAr ?? '' : item.nameEn ?? item.nameAr ?? ''}${'detail' in item && item.detail ? `, ${item.detail}` : ''}`} interactive>
            <View style={[styles.cardBody, item.kind === 'therapist' && styles.therapistBody]}>
              {item.kind === 'therapist' ? (
                <Avatar size={64} name={(dir.isRTL ? item.nameAr : item.nameEn ?? item.nameAr) ?? ''} imageUrl={item.imageUrl} />
              ) : null}
              <Text numberOfLines={item.kind === 'therapist' ? 1 : undefined} style={[styles.cardText, item.kind === 'therapist' && styles.gridName, { fontFamily: bold, textAlign: item.kind === 'therapist' ? 'center' : dir.textAlign }]}>
                {dir.isRTL ? item.nameAr : item.nameEn ?? item.nameAr}
              </Text>
              {'title' in item && typeof item.title === 'string' && item.title ? (
                <Text numberOfLines={1} style={[styles.cardDetail, styles.gridDetail, { fontFamily: bold, textAlign: 'center', color: colors.teal[700] }]}>{item.title}</Text>
              ) : null}
              {'bio' in item && typeof item.bio === 'string' && item.bio ? (
                <Text numberOfLines={2} style={[styles.cardDetail, styles.gridDetail, { fontFamily: getFontName(dir.locale, '400'), textAlign: 'center' }]}>{item.bio}</Text>
              ) : null}
              {'detail' in item && typeof item.detail === 'string' ? (
                <Text style={[styles.cardDetail, { textAlign: dir.textAlign }]}>{item.detail}</Text>
              ) : null}
            </View>
          </Glass>
        )}
      />
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 12, flexGrow: 1 },
  header: { gap: 14, marginBottom: 16 },
  title: { color: colors.ink[900], fontSize: 24 },
  card: { marginBottom: 12 },
  gridRow: { justifyContent: 'space-between', gap: 10 },
  squareCard: { width: '48%', aspectRatio: 1 },
  therapistBody: { paddingHorizontal: 10, paddingVertical: 10, gap: 4, alignItems: 'center' },
  gridName: { fontSize: 14, lineHeight: 20, alignSelf: 'stretch' },
  gridDetail: { fontSize: 11, lineHeight: 16, alignSelf: 'stretch' },
  cardBody: { paddingHorizontal: 18, paddingVertical: 16, gap: 4 },
  cardText: { color: colors.ink[900], fontSize: 16 },
  cardDetail: { color: colors.ink[500], fontSize: 13 },
  empty: { color: colors.ink[500], textAlign: 'center', padding: 24 },
});
