import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Mail, MapPin, Phone } from 'lucide-react-native';

import { MenuGroup } from '@/components/ui/MenuGroup';
import { Pill } from '@/components/ui/Pill';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useBranding, usePublicBranches } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

/** Branch list at the bottom of the overview; hidden until there is at least one branch. */
export function ExploreBranches() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useSawaaColors();
  const dir = useDir();
  const branches = usePublicBranches().data ?? [];
  if (branches.length === 0) return null;
  return (
    <View style={styles.section}>
      <SectionHeader title={t('branches.title')} />
      {branches.map((branch) => {
        const name = dir.locale === 'ar' ? branch.nameAr : branch.nameEn || branch.nameAr;
        const place = [branch.city, dir.locale === 'ar' ? branch.addressAr : null].filter(Boolean).join(dir.isRTL ? '، ' : ', ');
        return (
          <Glass
            key={branch.id}
            variant="strong"
            radius={sawaaRadius.lg}
            interactive
            onPress={() => router.push({ pathname: '/branch/[id]', params: { id: branch.id } })}
            accessibilityRole="button"
            accessibilityLabel={name}
            testID={`explore-branch-${branch.id}`}
            style={styles.branch}
          >
            <View style={[styles.branchRow, { flexDirection: dir.row }]}>
              <MapPin size={22} color={colors.teal[700]} strokeWidth={1.75} />
              <View style={[styles.branchText, { alignItems: dir.alignStart }]}>
                <Text numberOfLines={2} style={[styles.name, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700'), textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>{name}</Text>
                {place ? <Text numberOfLines={2} style={[styles.place, { color: colors.ink[500], fontFamily: getFontName(dir.locale, '400'), textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>{place}</Text> : null}
                {branch.isMain ? <Pill label={t('branches.main')} tone="brand" /> : null}
              </View>
            </View>
          </Glass>
        );
      })}
    </View>
  );
}

/** Phone and email rows for the centre; rows without data are omitted. */
export function ExploreCenter() {
  const { t } = useTranslation();
  const branding = useBranding().data;
  const phone = branding?.contactPhone ?? null;
  const email = branding?.contactEmail ?? null;
  const entries = [
    phone ? { key: 'phone', icon: Phone, label: t('explore.contact'), value: phone, valueDirection: 'ltr' as const, onPress: () => { void Linking.openURL(`tel:${phone}`); } } : null,
    email ? { key: 'email', icon: Mail, label: t('explore.email'), value: email, valueDirection: 'ltr' as const, onPress: () => { void Linking.openURL(`mailto:${email}`); } } : null,
  ].filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  if (entries.length === 0) return null;
  return <MenuGroup title={t('explore.centerTitle')} entries={entries} />;
}

const styles = StyleSheet.create({
  section: { gap: 10 },
  branch: { minHeight: 68, justifyContent: 'center', padding: 15 },
  branchRow: { alignItems: 'center', gap: 12 },
  branchText: { flex: 1, minWidth: 0, gap: 4 },
  name: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  place: { fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight },
});
