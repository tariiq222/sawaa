import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, ClipboardList } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { usePublicCatalog } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { HomeSectionState } from './HomeSectionState';
import { Glass } from '@/theme/components/Glass';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
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
    <HomeSectionState loading={catalog.isLoading} error={catalog.isError} hasData={services.length > 0} onRetry={() => { void catalog.refetch(); }}><View style={styles.section}>
      <SectionHeader title={t('home.assessmentServices')} />
      {services.map((service) => (
        <Glass key={service.id} variant="strong" radius={sawaaRadius.lg} padding={sawaaSpacing.lg} interactive
          accessibilityLabel={dir.isRTL ? service.nameAr : service.nameEn ?? service.nameAr}
          onPress={() => router.push({ pathname: '/public-detail/[kind]/[id]', params: { kind: 'service', id: service.id } })}>
          <View style={[styles.row, { flexDirection: dir.row }]}>
            <ClipboardList size={22} color={colors.teal[700]} strokeWidth={1.6} />
            <Text style={[styles.name, { fontFamily: regular, color: colors.ink[900], textAlign: dir.textAlign }]}>{dir.isRTL ? service.nameAr : service.nameEn ?? service.nameAr}</Text>
            <Arrow size={17} color={colors.teal[700]} />
          </View>
        </Glass>
      ))}
    </View></HomeSectionState>
  );
}
const styles = StyleSheet.create({
  section: { gap: 12 },
  row: { alignItems: 'center', gap: 10, minHeight: 24 },
  name: { flex: 1, fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
});
