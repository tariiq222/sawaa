import React, { useCallback, useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { FlatList, Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { BackButton } from '@/components/ui/BackButton';
import { useClinics } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import type { ClinicEntry } from '@/lib/clinics';
import { AquaBackground, sawaaRadius } from '@/theme/sawaa';
import { concentricRadius } from '@/theme/sawaa/tokens';
import { Glass } from '@/theme/components/Glass';
import { ThemedText } from '@/theme/components/ThemedText';

const CARD_RADIUS = sawaaRadius.xl;
const CARD_PADDING = 16;

export default function ClinicsScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const clinicsQuery = useClinics();
  const clinics = useMemo(() => clinicsQuery.data ?? [], [clinicsQuery.data]);

  const renderItem = useCallback(({ item }: { item: ClinicEntry }) => {
    const name = dir.isRTL ? item.nameAr : (item.nameEn ?? item.nameAr);
    return (
      <Glass
        variant="strong"
        radius={CARD_RADIUS}
        onPress={() => router.push({ pathname: '/(client)/clinic/[id]', params: { id: item.id } })}
        accessibilityLabel={`${name}, ${t('clinics.therapistsCount', { count: item.therapistCount })}, ${t('clinics.servicesCount', { count: item.serviceCount })}`}
        interactive
        style={styles.card}
      >
        <View style={[styles.cardBody, { flexDirection: dir.row }]}>
          {item.imageUrl ? (
            <Image source={{ uri: item.imageUrl }} style={styles.clinicImage} accessibilityLabel={name} />
          ) : (
            <View style={styles.iconWrap}>
              <AppIcon sf="building.2.fill" fallback={Building2} size={24} color={colors.teal[700]} strokeWidth={1.6} />
            </View>
          )}
          <View style={styles.cardText}>
            <ThemedText variant="subheading" style={{ textAlign: dir.textAlign }} numberOfLines={2}>
              {name}
            </ThemedText>
            {(dir.isRTL ? item.descriptionAr : item.descriptionEn ?? item.descriptionAr) ? (
              <ThemedText variant="bodySm" color={colors.ink[500]} style={{ textAlign: dir.textAlign }} numberOfLines={2}>
                {dir.isRTL ? item.descriptionAr : item.descriptionEn ?? item.descriptionAr}
              </ThemedText>
            ) : null}
            <ThemedText variant="bodySm" color={colors.ink[500]} style={{ textAlign: dir.textAlign }}>
              {item.serviceCount > 0
                ? `${t('clinics.therapistsCount', { count: item.therapistCount })} · ${t('clinics.servicesCount', { count: item.serviceCount })}`
                : t('clinics.therapistsCount', { count: item.therapistCount })}
            </ThemedText>
          </View>
          <AppIcon sf={dir.isRTL ? 'chevron.left' : 'chevron.right'} fallback={dir.isRTL ? ChevronLeft : ChevronRight} size={18} color={colors.ink[500]} strokeWidth={1.6} />
        </View>
      </Glass>
    );
  }, [colors, styles, dir, router, t]);

  const emptyState = useMemo(() => {
    if (clinicsQuery.isLoading) return (
      <View style={styles.emptyState}><ThemedText variant="bodySm" align="center">{t('common.loading')}</ThemedText></View>
    );
    if (clinicsQuery.isError) return (
      <View style={styles.emptyState}>
        <ThemedText variant="bodySm" color={colors.ink[500]} align="center">{t('clinics.loadError')}</ThemedText>
        <Glass variant="strong" radius={sawaaRadius.md} interactive
          accessibilityLabel={t('common.retry')} onPress={() => { void clinicsQuery.refetch(); }} style={styles.retry}>
          <ThemedText variant="bodySm" align="center">{t('common.retry')}</ThemedText>
        </Glass>
      </View>
    );
    return (
      <View style={styles.emptyState}>
        <ThemedText variant="bodySm" color={colors.ink[500]} align="center">{t('clinics.empty')}</ThemedText>
      </View>
    );
  }, [colors, styles, clinicsQuery.isLoading, clinicsQuery.isError, clinicsQuery.refetch, t]);

  return (
    <AquaBackground>
      <FlatList
        data={clinics}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={(
          <View style={[styles.headerRow, { flexDirection: dir.row }]}> 
            <BackButton onPress={() => router.back()} />
            <ThemedText variant="subheading">{t('clinics.title')}</ThemedText>
            <View style={styles.backBtn} />
          </View>
        )}
        ListEmptyComponent={emptyState}
      />
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  list: { flexGrow: 1, paddingHorizontal: 24, gap: 12 },
  headerRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { marginBottom: 12 },
  cardBody: { alignItems: 'center', gap: 12, padding: CARD_PADDING },
  clinicImage: { width: 56, height: 56, borderRadius: sawaaRadius.md },
  retry: { marginTop: 12, paddingHorizontal: 24, paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: concentricRadius(CARD_RADIUS, CARD_PADDING),
    backgroundColor: colors.glass.opaqueBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 3 },
  emptyState: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center' },
});
