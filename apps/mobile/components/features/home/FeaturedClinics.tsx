import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Building2, Star } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import type { DirState } from '@/hooks/useDir';

const CLINICS = [
  { id: '1', ar: 'عيادة النفسية', en: 'Wellness Clinic', rating: 4.7 },
  { id: '2', ar: 'مركز الصحة', en: 'Health Center', rating: 4.8 },
  { id: '3', ar: 'عيادة النور', en: 'Noor Clinic', rating: 4.6 },
  { id: '4', ar: 'مركز السكينة', en: 'Serenity Center', rating: 4.9 },
];

interface FeaturedClinicsProps {
  dir: DirState;
  f600: string;
  f700: string;
}

export function FeaturedClinics({ dir, f600, f700 }: FeaturedClinicsProps) {
  const router = useRouter();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.hScrollContent, { flexDirection: dir.row }]}
    >
      {CLINICS.map((c) => (
        <Glass key={c.id} variant="strong" radius={sawaaRadius.xl} style={styles.clinicCard}>
          <Pressable onPress={() => router.push(`/(client)/clinic/${c.id}`)} style={styles.clinicInner}>
            <LinearGradient
              colors={[sawaaColors.teal[300], sawaaColors.teal[500]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.clinicIcon}
            >
              <Building2 size={36} color="#fff" strokeWidth={1.5} />
            </LinearGradient>
            <Text style={[styles.clinicName, { fontFamily: f700, textAlign: dir.textAlign }]}>
              {dir.isRTL ? c.ar : c.en}
            </Text>
            <View style={[styles.clinicMeta, { flexDirection: dir.row }]}>
              <View style={[styles.clinicRating, { flexDirection: dir.row }]}>
                <Text style={[styles.clinicRatingText, { fontFamily: f600 }]}>{c.rating}</Text>
                <Star size={11} color={sawaaColors.accent.amber} strokeWidth={2} fill={sawaaColors.accent.amber} />
              </View>
            </View>
          </Pressable>
        </Glass>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hScrollContent: { gap: 10, paddingHorizontal: 2 },
  clinicCard: { width: 170 },
  clinicInner: { padding: 12, gap: 10 },
  clinicIcon: { height: 88, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  clinicName: { fontSize: 13.5, color: sawaaColors.ink[900], marginTop: 2 },
  clinicMeta: { justifyContent: 'space-between', alignItems: 'center' },
  clinicRating: { alignItems: 'center', gap: 3 },
  clinicRatingText: { fontSize: 11.5, color: sawaaColors.ink[900] },
});
