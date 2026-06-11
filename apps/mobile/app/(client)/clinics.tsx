import React, { useCallback, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { AppIcon } from '@/components/ui/AppIcon';
import { useClinics } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import type { ClinicEntry } from '@/lib/clinics';
import { AquaBackground, sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { concentricRadius } from '@/theme/sawaa/tokens';
import { Glass } from '@/theme/components/Glass';
import { ThemedText } from '@/theme/components/ThemedText';

const CARD_RADIUS = sawaaRadius.xl;
const CARD_PADDING = 16;

export default function ClinicsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const { t } = useTranslation();
  const clinicsQuery = useClinics();
  const clinics = useMemo(() => clinicsQuery.data ?? [], [clinicsQuery.data]);
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const backSymbol = (dir.isRTL ? 'chevron.right' : 'chevron.left') as React.ComponentProps<typeof AppIcon>['sf'];

  const renderItem = useCallback(({ item }: { item: ClinicEntry }) => {
    const name = dir.isRTL ? item.nameAr : (item.nameEn ?? item.nameAr);
    return (
      <Glass
        variant="strong"
        radius={CARD_RADIUS}
        onPress={() => router.push({ pathname: '/(client)/therapists', params: { clinicId: item.id } })}
        accessibilityLabel={name}
        style={styles.card}
      >
        <View style={[styles.cardBody, { flexDirection: dir.row }]}> 
          <View style={styles.iconWrap}>
            <AppIcon sf="building.2.fill" fallback={Building2} size={24} color={sawaaColors.teal[700]} strokeWidth={1.6} />
          </View>
          <View style={styles.cardText}>
            <ThemedText variant="subheading" style={{ textAlign: dir.textAlign }} numberOfLines={2}>
              {name}
            </ThemedText>
            <ThemedText variant="bodySm" color={sawaaColors.ink[500]} style={{ textAlign: dir.textAlign }}>
              {`${t('clinics.therapistsCount', { count: item.therapistCount })} · ${t('clinics.servicesCount', { count: item.serviceCount })}`}
            </ThemedText>
          </View>
        </View>
      </Glass>
    );
  }, [dir, router, t]);

  const emptyState = useMemo(() => {
    if (clinicsQuery.isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <ThemedText variant="bodySm" color={sawaaColors.ink[500]} align="center">
          {t('clinics.empty')}
        </ThemedText>
      </View>
    );
  }, [clinicsQuery.isLoading, t]);

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
            <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
              <AppIcon sf={backSymbol} fallback={BackIcon} size={24} color={sawaaColors.ink[900]} strokeWidth={1.5} />
            </Pressable>
            <ThemedText variant="subheading">{t('clinics.title')}</ThemedText>
            <View style={styles.backBtn} />
          </View>
        )}
        ListEmptyComponent={emptyState}
      />
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
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
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: concentricRadius(CARD_RADIUS, CARD_PADDING),
    backgroundColor: sawaaColors.glass.bgStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: 3 },
  emptyState: { flex: 1, minHeight: 260, alignItems: 'center', justifyContent: 'center' },
});
