import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { sawaaColors, sawaaRadius } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import type { DirState } from '@/hooks/useDir';
import type { PublicEmployeeItem } from '@/services/client/employees';

interface TherapistsRowProps {
  therapists: PublicEmployeeItem[];
  dir: DirState;
  f400: string;
  f600: string;
  f700: string;
}

export function TherapistsRow({ therapists, dir, f400, f600, f700 }: TherapistsRowProps) {
  const router = useRouter();

  if (therapists.length === 0) {
    return (
      <Glass variant="regular" radius={sawaaRadius.xl} style={styles.empty}>
        <Text style={[styles.emptyText, { fontFamily: f600, textAlign: dir.textAlign }]}>
          {dir.isRTL ? 'لا يوجد معالجون متاحون حالياً' : 'No therapists available right now'}
        </Text>
      </Glass>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.hScrollContent, { flexDirection: dir.row }]}
    >
      {therapists.map((t) => {
        const name = (dir.isRTL ? t.nameAr : t.nameEn) ?? t.nameAr ?? t.nameEn ?? '';
        const specialty = (dir.isRTL ? t.specialtyAr : t.specialty) ?? t.specialty ?? t.specialtyAr ?? '';
        const initial = name.trim().charAt(0) || '·';
        return (
          <Glass key={t.id} variant="strong" radius={sawaaRadius.xl} style={styles.card}>
            <Pressable
              onPress={() => router.push(`/(client)/employee/${t.slug ?? t.id}`)}
              style={styles.inner}
            >
              <LinearGradient
                colors={[sawaaColors.teal[400], sawaaColors.teal[600]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={[styles.avatarText, { fontFamily: f700 }]}>{initial}</Text>
              </LinearGradient>
              <Text
                style={[styles.name, { fontFamily: f700, textAlign: dir.textAlign }]}
                numberOfLines={1}
              >
                {name}
              </Text>
              <Text
                style={[styles.spec, { fontFamily: f400, textAlign: dir.textAlign }]}
                numberOfLines={1}
              >
                {specialty || (t.title ?? '')}
              </Text>
            </Pressable>
          </Glass>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hScrollContent: { gap: 10, paddingHorizontal: 2 },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 13, color: sawaaColors.ink[700] },
  card: { width: 150 },
  inner: { padding: 12, gap: 6, alignItems: 'center' },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  avatarText: { fontSize: 26, color: 'rgba(255,255,255,0.95)' },
  name: { fontSize: 12.5, color: sawaaColors.ink[900], width: '100%' },
  spec: { fontSize: 10.5, color: sawaaColors.ink[500], width: '100%' },
});
