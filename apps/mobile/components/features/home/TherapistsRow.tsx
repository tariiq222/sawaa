import React from 'react';
import { LocalizedHorizontalScroll } from '@/components/ui/LocalizedHorizontalScroll';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Thumb } from '@/components/ui/Thumb';
import { sawaaRadius, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import type { DirState } from '@/hooks/useDir';
import type { PublicEmployeeItem } from '@/services/client/employees';

interface TherapistsRowProps {
  therapists: PublicEmployeeItem[];
  dir: DirState;
  f400: string;
  f600: string;
  f700: string;
}

const PHOTO = 148;

/** Horizontal row of specialist photos with name and specialty. */
export function TherapistsRow({ therapists, dir, f400, f600, f700 }: TherapistsRowProps) {
  const colors = useSawaaColors();
  const router = useRouter();
  const [failedImages, setFailedImages] = React.useState<Record<string, string>>({});

  if (therapists.length === 0) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.glass.opaqueBg }]}>
        <Text style={[styles.emptyText, { fontFamily: f600, color: colors.ink[700], textAlign: dir.textAlign }]}>
          {dir.isRTL ? 'لا يوجد معالجون متاحون حالياً' : 'No therapists available right now'}
        </Text>
      </View>
    );
  }

  return (
    <LocalizedHorizontalScroll
      dir={dir}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.hScrollContent, { flexDirection: dir.row }]}
    >
      {therapists.map((t) => {
        const name = (dir.isRTL ? t.nameAr : t.nameEn) ?? t.nameAr ?? t.nameEn ?? '';
        const specialty = (dir.isRTL ? t.specialtyAr : t.specialty) ?? t.specialty ?? t.specialtyAr ?? '';
        const photo = t.publicImageUrl && failedImages[t.id] !== t.publicImageUrl ? t.publicImageUrl : null;
        return (
          <Pressable
            key={t.id}
            onPress={() => router.push({ pathname: '/public-detail/[kind]/[id]', params: { kind: 'therapist', id: t.slug ?? t.id } })}
            accessibilityRole="button"
            accessibilityLabel={name}
            style={styles.item}
          >
            <Thumb
              uri={photo}
              width={PHOTO}
              height={PHOTO}
              radius={sawaaRadius.lg}
              accessibilityLabel={name}
              onError={() => setFailedImages((previous) => ({ ...previous, [t.id]: t.publicImageUrl! }))}
            />
            <Text numberOfLines={1} style={[styles.name, { fontFamily: f700, color: colors.ink[900], textAlign: dir.textAlign }]}>{name}</Text>
            <Text numberOfLines={2} style={[styles.spec, { fontFamily: f400, color: colors.ink[500], textAlign: dir.textAlign }]}>{t.title || specialty}</Text>
          </Pressable>
        );
      })}
    </LocalizedHorizontalScroll>
  );
}

const styles = StyleSheet.create({
  hScrollContent: { gap: 12, paddingHorizontal: 2 },
  empty: { padding: 24, alignItems: 'center', borderRadius: sawaaRadius.xl },
  emptyText: { fontSize: 14 },
  item: { width: PHOTO, gap: 4 },
  name: { fontSize: 15, lineHeight: 22, marginTop: 4 },
  spec: { fontSize: sawaaType.caption.fontSize + 1, lineHeight: 18 },
});
