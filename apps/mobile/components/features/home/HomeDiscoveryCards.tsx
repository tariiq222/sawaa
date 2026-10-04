import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { sawaaRadius } from '@/theme/sawaa/tokens';
import { getFontName } from '@/theme/fonts';

const destinations = [
  { id: 'clinics', key: 'clinics.title', image: require('@/assets/discovery/clinics.webp'), client: '/(client)/clinics', guest: '/public-list/clinics' },
  { id: 'therapists', key: 'guest.therapists', image: require('@/assets/discovery/therapists.webp'), client: '/(client)/therapists', guest: '/public-list/therapists' },
  { id: 'packages', key: 'guest.packages', image: require('@/assets/discovery/packages.webp'), client: '/(client)/packages', guest: '/public-list/packages' },
  { id: 'programs', key: 'guest.programs', image: require('@/assets/discovery/programs.webp'), client: '/(client)/groups', guest: '/public-list/programs' },
] as const;

/**
 * Home shortcuts share the catalog destinations; they do not duplicate its data.
 * Clients get a 2x2 grid; guests get intro rows (image, title, short definition, chevron).
 */
export function HomeDiscoveryCards({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const dir = useDir();
  const colors = useSawaaColors();
  const { t } = useTranslation();
  const Arrow = dir.isRTL ? ChevronLeft : ChevronRight;
  const title = { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign } as const;
  const description = { color: colors.ink[700], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign } as const;

  if (!signedIn) {
    return (
      <View style={styles.list}>
        {destinations.map((item) => (
          <Glass key={item.id} variant="strong" radius={sawaaRadius.lg} padding={12} interactive
            onPress={() => router.push(item.guest as Href)} accessibilityLabel={t(item.key)}>
            <View style={[styles.rowInner, { flexDirection: dir.row }]}>
              <Image source={item.image} style={styles.rowImage} resizeMode="cover" accessible={false} />
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, title]}>{t(item.key)}</Text>
                <Text numberOfLines={2} style={[styles.rowDescription, description]}>{t(`guest.${item.id}Description`)}</Text>
              </View>
              <Arrow size={20} color={colors.teal[700]} strokeWidth={2} />
            </View>
          </Glass>
        ))}
      </View>
    );
  }

  return (
    <View style={[styles.grid, { flexDirection: dir.row }]}>
      {destinations.map((item) => (
        <Glass key={item.id} variant="strong" radius={sawaaRadius.lg} style={styles.card}
          onPress={() => router.push(item.client as Href)}
          accessibilityLabel={t(item.key)} interactive>
          <Image source={item.image} style={styles.image} resizeMode="cover" accessible={false} />
          <View style={styles.caption}>
            <Text style={[styles.title, title]}>{t(item.key)}</Text>
            <Text numberOfLines={2} style={[styles.description, description]}>{t(`guest.${item.id}Description`)}</Text>
          </View>
        </Glass>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  card: { width: '48%' },
  image: { width: '100%', height: 96 },
  caption: { padding: 12, gap: 3, minHeight: 88 },
  title: { fontSize: 16, lineHeight: 22 },
  description: { fontSize: 13, lineHeight: 18 },
  list: { gap: 12 },
  rowInner: { alignItems: 'center', gap: 12 },
  rowImage: { width: 84, height: 84, borderRadius: sawaaRadius.md },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, lineHeight: 22 },
  rowDescription: { fontSize: 14, lineHeight: 20 },
});
