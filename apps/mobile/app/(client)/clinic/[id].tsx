import React, { useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/useTheme';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AquaBackground, sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';
import { useClinics } from '@/hooks/queries';

const HERO_HEIGHT = 200;

export default function ClinicDetailScreen() {
  const colors = useSawaaColors();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(colors, theme.colors), [colors, theme.colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const f500 = getFontName(dir.locale, '500');
  const f700 = getFontName(dir.locale, '700');
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;
  const GoIcon = dir.isRTL ? ChevronLeft : ChevronRight;

  // The clinic directory is derived from the public catalog + bookable
  // therapists; this route renders one entry of that same list.
  const clinicsQuery = useClinics();
  const clinic = useMemo(
    () => (clinicsQuery.data ?? []).find((entry) => entry.id === id),
    [clinicsQuery.data, id],
  );

  const clinicName = clinic
    ? (dir.isRTL ? clinic.nameAr : (clinic.nameEn ?? clinic.nameAr))
    : '';

  const renderBody = () => {
    if (clinicsQuery.isLoading) {
      return (
        <View style={styles.stateWrap}>
          <Skeleton height={96} radius={sawaaRadius.xl} />
          <Skeleton height={56} radius={sawaaRadius.lg} />
        </View>
      );
    }

    if (clinicsQuery.isError) {
      return (
        <EmptyState
          icon="alert-circle-outline"
          title={t('common.error')}
          actionLabel={t('common.retry')}
          onAction={() => { void clinicsQuery.refetch(); }}
          tone="danger"
        />
      );
    }

    if (!clinic) {
      return (
        <EmptyState
          icon="information-circle-outline"
          title={t('clinics.notFound')}
          actionLabel={t('clinics.title')}
          onAction={() => router.replace('/(client)/clinics')}
        />
      );
    }

    return (
      <>
        {/* Info card overlay (name + bookable counts) — sits at the bottom of the hero */}
        <Animated.View entering={FadeInDown.delay(100).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.infoCard}>
            <Text style={[styles.clinicName, { fontFamily: f700, textAlign: dir.textAlign }]}>
              {clinicName}
            </Text>
            <View style={[styles.metaRow, { flexDirection: dir.row }]}>
              <Text style={[styles.clinicMeta, { fontFamily: f500, fontWeight: '500' }]}>
                {t('clinics.therapistsCount', { count: clinic.therapistCount })}
              </Text>
              {clinic.serviceCount > 0 ? <Text style={[styles.clinicMeta, { fontFamily: f500, fontWeight: '500' }]}>
                {t('clinics.servicesCount', { count: clinic.serviceCount })}
              </Text> : null}
            </View>
          </Glass>
        </Animated.View>
      </>
    );
  };

  return (
    <AquaBackground>
      {/* Hero region with glass overlay (name + counts) */}
      <LinearGradient
        colors={[colors.teal[300], colors.teal[600], colors.teal[900]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroIcon}>
          <Building2 size={160} color={theme.colors.primaryForeground} opacity={0.28} strokeWidth={1} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button over hero */}
        <Animated.View entering={FadeInDown.duration(500)}>
          <Glass variant="strong" radius={22} onPress={() => router.back()} interactive accessibilityLabel={t('a11y.buttonBack')} style={[styles.backBtn, { alignSelf: dir.alignStart }]}>
            <BackIcon size={22} color={colors.ink[700]} strokeWidth={1.75} />
          </Glass>
        </Animated.View>

        {/* Spacer so content starts below hero (hero is 200, with info card overlapping by ~36) */}
        <View style={{ height: HERO_HEIGHT - 56 - 44 - 12 }} />

        {renderBody()}
      </ScrollView>

      {clinic ? (
        <Animated.View
          entering={FadeInDown.delay(360).duration(800).easing(Easing.out(Easing.cubic))}
          style={[styles.ctaWrap, { bottom: insets.bottom + 20 }]}
        >
          <Glass variant="strong" radius={sawaaRadius.pill} style={styles.ctaPill}>
            <Pressable
              onPress={() => router.push({ pathname: '/(client)/therapists', params: { clinicId: clinic.id } })}
              style={styles.ctaBtnPress}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={theme.colors.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaBtn}
              >
                <Text style={[styles.ctaBtnText, { fontFamily: f700 }]}>
                  {t('therapists.title')}
                </Text>
                <GoIcon size={14} color={theme.colors.primaryForeground} strokeWidth={2} />
              </LinearGradient>
            </Pressable>
          </Glass>
        </Animated.View>
      ) : null}
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>, themeColors: ReturnType<typeof useTheme>['theme']['colors']) => StyleSheet.create({
  hero: { position: 'absolute', top: 0, left: 0, right: 0, height: HERO_HEIGHT, overflow: 'hidden' },
  heroIcon: { position: 'absolute', bottom: -20, left: 0, right: 0, alignItems: 'center' },
  scroll: { paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  stateWrap: { gap: sawaaSpacing.md },
  infoCard: { padding: sawaaSpacing.lg, gap: sawaaSpacing.sm },
  clinicName: { fontSize: 20, color: colors.ink[900] },
  metaRow: { flexWrap: 'wrap', gap: sawaaSpacing.md, alignItems: 'center' },
  clinicMeta: { fontSize: sawaaType.caption.fontSize, color: colors.ink[500] },
  ctaWrap: { position: 'absolute', left: sawaaSpacing.lg, right: sawaaSpacing.lg },
  ctaPill: { padding: 6 },
  ctaBtnPress: { height: 46 },
  ctaBtn: {
    flex: 1, borderRadius: 999, height: 46,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    shadowColor: colors.teal[600], shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 },
  },
  ctaBtnText: { color: themeColors.primaryForeground, fontSize: 13 },
});
