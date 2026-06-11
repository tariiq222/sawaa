import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppIcon } from '@/components/ui/AppIcon';
import { sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { concentricRadius } from '@/theme/sawaa/tokens';
import { Glass } from '@/theme/components/Glass';
import type { DirState } from '@/hooks/useDir';
import { useClinics } from '@/hooks/queries';

const CARD_RADIUS = sawaaRadius.xl;
const CARD_PADDING = 12;

interface FeaturedClinicsProps {
  dir: DirState;
  f600: string;
  f700: string;
}

export function FeaturedClinics({ dir, f600, f700 }: FeaturedClinicsProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const clinicsQuery = useClinics();
  const clinics = (clinicsQuery.data ?? []).slice(0, 6);

  if (clinicsQuery.isLoading || clinics.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.hScrollContent, { flexDirection: dir.row }]}
    >
      {clinics.map((c) => {
        const name = dir.isRTL ? c.nameAr : (c.nameEn ?? c.nameAr);
        return (
        <Glass key={c.id} variant="strong" radius={CARD_RADIUS} style={styles.clinicCard}>
          <Pressable
            onPress={() => router.push({ pathname: '/(client)/therapists', params: { clinicId: c.id } })}
            style={styles.clinicInner}
            accessibilityRole="button"
            accessibilityLabel={name}
          >
            <LinearGradient
              colors={[sawaaColors.teal[300], sawaaColors.teal[500]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.clinicIcon}
            >
              <AppIcon sf="building.2.fill" fallback={Building2} size={36} color={sawaaColors.teal[50]} strokeWidth={1.5} />
            </LinearGradient>
            <Text style={[styles.clinicName, { fontFamily: f700, textAlign: dir.textAlign }]}> 
              {name}
            </Text>
            <View style={[styles.clinicMeta, { flexDirection: dir.row }]}> 
              <View style={[styles.clinicRating, { flexDirection: dir.row }]}> 
                <Text style={[styles.clinicRatingText, { fontFamily: f600, fontWeight: '600' }]}> 
                  {t('clinics.therapistsCount', { count: c.therapistCount })}
                </Text>
                <AppIcon sf="star.fill" fallback={Star} size={11} color={sawaaColors.accent.amber} strokeWidth={2} />
              </View>
            </View>
          </Pressable>
        </Glass>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hScrollContent: { gap: 10, paddingHorizontal: 2 },
  clinicCard: { width: 170 },
  clinicInner: { padding: CARD_PADDING, gap: 10 },
  clinicIcon: { height: 88, borderRadius: concentricRadius(CARD_RADIUS, CARD_PADDING), alignItems: 'center', justifyContent: 'center' },
  clinicName: { fontSize: 13.5, color: sawaaColors.ink[900], marginTop: 2 },
  clinicMeta: { justifyContent: 'space-between', alignItems: 'center' },
  clinicRating: { alignItems: 'center', gap: 3 },
  clinicRatingText: { fontSize: 11.5, color: sawaaColors.ink[900] },
});
