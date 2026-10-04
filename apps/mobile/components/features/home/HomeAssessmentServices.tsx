import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { usePublicCatalog } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Glass } from '@/theme/components/Glass';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { getAssessmentServices } from '@/lib/assessment-services';

export function HomeAssessmentServices() {
  const catalog = usePublicCatalog();
  const services = getAssessmentServices(catalog.data);
  const router = useRouter();
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const regular = getFontName(dir.locale, '400');
  const Arrow = dir.isRTL ? ChevronLeft : ChevronRight;
  return (
    <View style={styles.section}>
      <SectionHeader title={t('home.assessmentServices')} />
      {catalog.isLoading ? <ActivityIndicator color={colors.teal[700]} /> : catalog.isError ? (
        <Glass padding={14} onPress={() => { void catalog.refetch(); }} accessibilityLabel={t('common.retry')}>
          <Text style={{ fontFamily: regular, color: colors.ink[700], textAlign: dir.textAlign }}>{t('guest.loadError')} · {t('common.retry')}</Text>
        </Glass>
      ) : services.length === 0 ? (
        <Text style={{ fontFamily: regular, color: colors.ink[700], textAlign: dir.textAlign }}>{t('home.assessmentServicesEmpty')}</Text>
      ) : services.map((service) => (
        <Glass key={service.id} variant="strong" radius={20} padding={16} interactive
          accessibilityLabel={dir.isRTL ? service.nameAr : service.nameEn ?? service.nameAr}
          onPress={() => router.push({ pathname: '/public-detail/[kind]/[id]', params: { kind: 'service', id: service.id } })}>
          <View style={[styles.row, { flexDirection: dir.row }]}>
            <ClipboardList size={22} color={colors.teal[700]} strokeWidth={1.6} />
            <Text style={[styles.name, { fontFamily: regular, color: colors.ink[900], textAlign: dir.textAlign }]}>{dir.isRTL ? service.nameAr : service.nameEn ?? service.nameAr}</Text>
            <Arrow size={17} color={colors.teal[700]} />
          </View>
        </Glass>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: 12 },
  row: { alignItems: 'center', gap: 10, minHeight: 24 },
  name: { flex: 1, fontSize: 15, lineHeight: 22 },
});
