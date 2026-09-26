import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { getFontName } from '@/theme/fonts';

const destinations = [
  { id: 'clinics', key: 'clinics.title', image: require('@/assets/discovery/clinics.webp'), client: '/(client)/clinics', guest: '/public-list/clinics' },
  { id: 'therapists', key: 'guest.therapists', image: require('@/assets/discovery/therapists.webp'), client: '/(client)/therapists', guest: '/public-list/therapists' },
  { id: 'packages', key: 'guest.packages', image: require('@/assets/discovery/packages.webp'), client: '/(client)/packages', guest: '/public-list/packages' },
  { id: 'programs', key: 'guest.programs', image: require('@/assets/discovery/programs.webp'), client: '/(client)/groups', guest: '/public-list/programs' },
] as const;

/** Home shortcuts share the catalog destinations; they do not duplicate its data. */
export function HomeDiscoveryCards({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const dir = useDir();
  const colors = useSawaaColors();
  const { t } = useTranslation();
  return (
    <View style={[styles.grid, { flexDirection: dir.row }]}>
      {destinations.map((item) => (
        <Glass key={item.id} variant="strong" radius={20} style={styles.card}
          onPress={() => router.push((signedIn ? item.client : item.guest) as Href)}
          accessibilityLabel={t(item.key)} interactive>
          <Image source={item.image} style={styles.image} resizeMode="cover" accessible={false} />
          <View style={styles.caption}>
            <Text style={[styles.title, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign }]}>{t(item.key)}</Text>
            <Text numberOfLines={2} style={[styles.description, { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign }]}>{t(`guest.${item.id}Description`)}</Text>
          </View>
        </Glass>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  card: { width: '48%' },
  image: { width: '100%', height: 92 },
  caption: { padding: 12, gap: 3, minHeight: 86 },
  title: { fontSize: 15, lineHeight: 22 },
  description: { fontSize: 11, lineHeight: 17 },
});
