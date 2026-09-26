import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Glass } from '@/theme/components/Glass';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import type { DirState } from '@/hooks/useDir';
import { useClinics } from '@/hooks/queries';
import { useAppSelector } from '@/hooks/use-redux';

interface FeaturedClinicsProps { dir: DirState; f600: string; f700: string }

export function FeaturedClinics({ dir, f600, f700 }: FeaturedClinicsProps) {
  const colors = useSawaaColors();
  const router = useRouter();
  const { t } = useTranslation();
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const clinicsQuery = useClinics();
  const clinics = (clinicsQuery.data ?? []).slice(0, 6);
  if (clinicsQuery.isLoading || clinics.length === 0) return null;
  return (
    <View style={styles.list}>
      {clinics.map((clinic) => {
        const name = dir.isRTL ? clinic.nameAr : clinic.nameEn ?? clinic.nameAr;
        return (
          <Glass key={clinic.id} variant="strong" radius={20} padding={16}
            onPress={() => router.push({ pathname: signedIn ? '/(client)/clinic/[id]' : '/public-clinic/[id]', params: { id: clinic.id } })}
            accessibilityLabel={name} interactive>
            <Text style={[styles.name, { fontFamily: f700, color: colors.ink[900], textAlign: dir.textAlign }]}>{name}</Text>
            <Text style={[styles.meta, { fontFamily: f600, color: colors.ink[500], textAlign: dir.textAlign }]}>
              {t('clinics.therapistsCount', { count: clinic.therapistCount })} · {t('clinics.servicesCount', { count: clinic.serviceCount })}
            </Text>
          </Glass>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  list: { gap: 10 },
  name: { fontSize: 15, lineHeight: 23 },
  meta: { fontSize: 11, lineHeight: 17, marginTop: 2 },
});
