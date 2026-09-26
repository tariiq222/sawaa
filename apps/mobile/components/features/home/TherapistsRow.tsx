import React from 'react';
import { LocalizedHorizontalScroll } from '@/components/ui/LocalizedHorizontalScroll';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Glass } from '@/theme/components/Glass';
import { useRouter } from 'expo-router';

import { sawaaRadius, withAlpha } from '@/theme/sawaa/tokens';
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

export function TherapistsRow({ therapists, dir, f400, f600, f700 }: TherapistsRowProps) {
  const sawaaColors = useSawaaColors();
  const styles = React.useMemo(() => createStyles(sawaaColors), [sawaaColors]);
  const router = useRouter();
  const [failedImages, setFailedImages] = React.useState<Record<string, string>>({});

  if (therapists.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { fontFamily: f600, fontWeight: '600', textAlign: dir.textAlign }]}>
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
        const initial = name.trim().charAt(0) || '·';
        return (
          <Glass key={t.id} variant="strong" radius={24} style={styles.card}>
            <Pressable
              onPress={() => router.push({ pathname: '/public-detail/[kind]/[id]', params: { kind: 'therapist', id: t.slug ?? t.id } })}
              accessibilityRole="button" accessibilityLabel={name}
              style={styles.inner}
            >
              {t.publicImageUrl && failedImages[t.id] !== t.publicImageUrl ? (
                <Image
                  source={{ uri: t.publicImageUrl }}
                  accessible
                  accessibilityRole="image"
                  accessibilityLabel={name}
                  style={styles.avatar}
                  resizeMode="cover"
                  onError={() => setFailedImages((previous) => ({ ...previous, [t.id]: t.publicImageUrl! }))}
                />
              ) : <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={[styles.avatarText, { fontFamily: f700 }]}>{initial}</Text>
              </View>}
              <Text
                style={[styles.name, { fontFamily: f700, textAlign: 'center' }]}
                numberOfLines={1}
              >
                {name}
              </Text>
              <Text
                style={[styles.spec, { fontFamily: f400, fontWeight: '400', textAlign: 'center' }]}
                numberOfLines={2}
              >
                {t.title || specialty}
              </Text>
            </Pressable>
          </Glass>
        );
      })}
    </LocalizedHorizontalScroll>
  );
}

const createStyles = (sawaaColors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  hScrollContent: { gap: 10, paddingHorizontal: 2 },
  empty: { padding: 24, alignItems: 'center', backgroundColor: sawaaColors.glass.opaqueBg, borderRadius: sawaaRadius.xl },
  emptyText: { fontSize: 13, color: sawaaColors.ink[700] },
  card: { width: 186, height: 186 },
  inner: { height: 186, padding: 14, gap: 6, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    position: 'relative',
  },
  avatarFallback: { backgroundColor: withAlpha(sawaaColors.teal[700], 0.1) },
  avatarText: { fontSize: 30, color: sawaaColors.teal[700] },
  name: { fontSize: 14, lineHeight: 21, color: sawaaColors.ink[900], width: '100%' },
  spec: { fontSize: 11, lineHeight: 17, color: sawaaColors.ink[500], width: '100%' },
});
