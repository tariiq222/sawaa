import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Building2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { LocalizedHorizontalScroll } from '@/components/ui/LocalizedHorizontalScroll';
import { Thumb } from '@/components/ui/Thumb';
import { sawaaRadius } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import type { DirState } from '@/hooks/useDir';
import { useClinics } from '@/hooks/queries';
import { useAppSelector } from '@/hooks/use-redux';

interface FeaturedClinicsProps { dir: DirState; f600: string; f700: string }

const PHOTO_W = 224;

/** Horizontal row of clinic photos with name and a short real description (or counts). */
export function FeaturedClinics({ dir, f600, f700 }: FeaturedClinicsProps) {
  const colors = useSawaaColors();
  const router = useRouter();
  const { t } = useTranslation();
  const signedIn = useAppSelector((state) => Boolean(state.auth.token));
  const [failedImages, setFailedImages] = React.useState<Record<string, string>>({});
  const clinicsQuery = useClinics();
  const clinics = (clinicsQuery.data ?? []).slice(0, 6);
  if (clinicsQuery.isLoading || clinics.length === 0) return null;
  return (
    <LocalizedHorizontalScroll dir={dir} showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.list, { flexDirection: dir.row }]}>
      {clinics.map((clinic) => {
        const name = dir.isRTL ? clinic.nameAr : clinic.nameEn ?? clinic.nameAr;
        const description = (dir.isRTL ? clinic.descriptionAr : clinic.descriptionEn ?? clinic.descriptionAr)?.trim();
        const meta = description || `${t('clinics.therapistsCount', { count: clinic.therapistCount })} · ${t('clinics.servicesCount', { count: clinic.serviceCount })}`;
        const photo = clinic.imageUrl && failedImages[clinic.id] !== clinic.imageUrl ? clinic.imageUrl : null;
        return (
          <Pressable
            key={clinic.id}
            onPress={() => router.push({ pathname: signedIn ? '/(client)/clinic/[id]' : '/public-clinic/[id]', params: { id: clinic.id } })}
            accessibilityRole="button"
            accessibilityLabel={name}
            style={styles.item}
          >
            <Thumb
              uri={photo}
              width={PHOTO_W}
              height={128}
              radius={sawaaRadius.lg}
              icon={Building2}
              onError={() => setFailedImages((previous) => ({ ...previous, [clinic.id]: clinic.imageUrl! }))}
            />
            <Text numberOfLines={1} style={[styles.name, { fontFamily: f700, color: colors.ink[900], textAlign: dir.textAlign }]}>{name}</Text>
            <Text numberOfLines={2} style={[styles.meta, { fontFamily: f600, color: colors.ink[500], textAlign: dir.textAlign }]}>{meta}</Text>
          </Pressable>
        );
      })}
    </LocalizedHorizontalScroll>
  );
}
const styles = StyleSheet.create({
  list: { gap: 12, paddingHorizontal: 2 },
  item: { width: PHOTO_W, gap: 4 },
  name: { fontSize: 15, lineHeight: 22, marginTop: 4 },
  meta: { fontSize: 13, lineHeight: 18 },
});
