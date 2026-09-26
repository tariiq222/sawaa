import React from 'react';
import { LocalizedHorizontalScroll } from '@/components/ui/LocalizedHorizontalScroll';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { sawaaRadius, getSawaaRoles } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { useTheme } from '@/theme/ThemeProvider';
import type { DirState } from '@/hooks/useDir';
import type { PublicEmployeeItem } from '@/services/client/employees';

interface TherapistsRowProps {
  therapists: PublicEmployeeItem[];
  dir: DirState;
  f400: string;
  f600: string;
  f700: string;
  isClient?: boolean;
}

export function TherapistsRow({ therapists, dir, f400, f600, f700, isClient = true }: TherapistsRowProps) {
  const sawaaColors = useSawaaColors();
  const { scheme } = useTheme();
  const action = getSawaaRoles(scheme).action;
  const styles = React.useMemo(() => createStyles(sawaaColors, action), [sawaaColors, action]);
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
          <View key={t.id} style={styles.card}>
            <Pressable
              onPress={() => router.push(isClient
                ? `/(client)/employee/${t.slug ?? t.id}`
                : { pathname: '/public-detail/[kind]/[id]', params: { kind: 'therapist', id: t.slug ?? t.id } })}
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
              ) : <LinearGradient
                colors={action.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={[styles.avatarText, { fontFamily: f700 }]}>{initial}</Text>
              </LinearGradient>}
              <Text
                style={[styles.name, { fontFamily: f700, textAlign: dir.textAlign }]}
                numberOfLines={1}
              >
                {name}
              </Text>
              <Text
                style={[styles.spec, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}
                numberOfLines={1}
              >
                {specialty || (t.title ?? '')}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </LocalizedHorizontalScroll>
  );
}

const createStyles = (sawaaColors: ReturnType<typeof useSawaaColors>, action: ReturnType<typeof getSawaaRoles>['action']) => StyleSheet.create({
  hScrollContent: { gap: 10, paddingHorizontal: 2 },
  empty: { padding: 24, alignItems: 'center', backgroundColor: sawaaColors.glass.opaqueBg, borderRadius: sawaaRadius.xl },
  emptyText: { fontSize: 13, color: sawaaColors.ink[700] },
  card: { width: 150, backgroundColor: sawaaColors.glass.opaqueBg, borderRadius: sawaaRadius.xl, overflow: 'hidden' },
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
  avatarText: { fontSize: 26, color: action.foreground },
  name: { fontSize: 12.5, color: sawaaColors.ink[900], width: '100%' },
  spec: { fontSize: 10.5, color: sawaaColors.ink[500], width: '100%' },
});
