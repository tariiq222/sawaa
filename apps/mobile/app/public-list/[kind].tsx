import React, { useMemo } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

import { useClinics, useTherapists, useGroupSessions, usePackageFamilies } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { AquaBackground } from '@/theme/sawaa';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Glass } from '@/theme/components/Glass';
import { GuestDock, type GuestDockSection } from '@/components/features/home/GuestDock';
import { AppIcon } from '@/components/ui/AppIcon';
import { useAppSelector } from '@/hooks/use-redux';
import { goBackOrHome } from '@/lib/navigation';

export default function PublicListScreen() {
  const { kind, clinicId } = useLocalSearchParams<{ kind?: string; clinicId?: string }>();
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
  const visibleTherapists = therapists.data?.filter((person) =>
    !clinicId || (selectedClinic != null && person.serviceIds.some((id) => selectedClinic.serviceIds.includes(id)))) ?? [];
  const entries = kind === 'clinics' ? (clinics.data ?? []).map((item) => ({ id: item.id, kind: 'clinic', nameAr: item.nameAr, nameEn: item.nameEn ?? null }))
    : kind === 'therapists' ? visibleTherapists.map((item) => ({ id: item.slug ?? item.id, kind: 'therapist', nameAr: item.nameAr, nameEn: item.nameEn ?? null }))
      : kind === 'packages' ? (families.data ?? []).map((item) => ({ id: item.id, kind: 'package', nameAr: item.nameAr, nameEn: item.nameEn ?? null }))
        : kind === 'programs' ? (programs.data ?? []).map((item) => ({ id: item.id, kind: 'program', nameAr: item.nameAr, nameEn: item.nameEn ?? null })) : [];
  const valid = kind === 'clinics' || kind === 'therapists' || kind === 'packages' || kind === 'programs';
  const dockSection: GuestDockSection | null = valid ? kind as GuestDockSection : null;
  const loading = kind === 'clinics' ? clinics.isLoading : kind === 'therapists' ? therapists.isLoading : kind === 'packages' ? families.isLoading : programs.isLoading;
  const title = kind === 'clinics' ? t('clinics.title') : kind === 'therapists' ? t('guest.therapists') : kind === 'packages' ? t('guest.packages') : t('guest.programs');

  return (
    <AquaBackground>
      <FlatList
        data={entries}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: isGuest ? insets.bottom + 120 : insets.bottom + 40 }]}
        ListHeaderComponent={(
          <View style={styles.header}>
            <Glass variant="clear" radius={18} style={[styles.back, { alignSelf: dir.alignStart }]}
              onPress={() => goBackOrHome(router)}
              accessibilityLabel={t('a11y.buttonBack')} interactive>
              <AppIcon sf={dir.isRTL ? 'chevron.right' : 'chevron.left'} fallback={dir.isRTL ? ChevronRight : ChevronLeft} size={21} color={colors.teal[700]} />
            </Glass>
            <Text accessibilityRole="header" style={[styles.title, { fontFamily: bold, textAlign: dir.textAlign }]}>{title}</Text>
            {valid && loading ? <ActivityIndicator color={colors.teal[700]} /> : null}
          </View>
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>{t('guest.empty')}</Text> : null}
        renderItem={({ item }) => (
          <Glass variant="strong" radius={20} style={styles.card}
            onPress={() => item.kind === 'clinic'
              ? router.push({ pathname: '/public-list/[kind]', params: { kind: 'therapists', clinicId: item.id } })
              : router.push({ pathname: '/public-detail/[kind]/[id]', params: { kind: item.kind, id: item.id, ...(item.kind === 'therapist' && clinicId ? { clinicId } : {}) } })}
            accessibilityLabel={dir.isRTL ? item.nameAr ?? '' : item.nameEn ?? item.nameAr ?? ''} interactive>
            <Text style={[styles.cardText, { fontFamily: bold, textAlign: dir.textAlign }]}>
              {dir.isRTL ? item.nameAr : item.nameEn ?? item.nameAr}
            </Text>
          </Glass>
        )}
      />
      {isGuest && dockSection ? <GuestDock active={dockSection} /> : null}
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  content: { paddingHorizontal: 16, gap: 12, flexGrow: 1 },
  header: { gap: 14, marginBottom: 16 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink[900], fontSize: 24 },
  card: { marginBottom: 12 },
  cardText: { color: colors.ink[900], fontSize: 16, padding: 18 },
  empty: { color: colors.ink[500], textAlign: 'center', padding: 24 },
});
