import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Info, Smartphone } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useDir } from '@/hooks/useDir';
import { getAppVersion } from '@/lib/app-version';
import { getFontName } from '@/theme/fonts';
import { Glass } from '@/theme/components/Glass';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { SectionHeader } from '@/components/ui/SectionHeader';

export function AboutSection() {
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const { version, buildNumber } = getAppVersion(Constants);
  const rows = [
    { icon: Info, label: t('settings.version'), value: version },
    { icon: Smartphone, label: t('settings.buildNumber'), value: buildNumber },
  ];
  return <View style={styles.section}>
    <SectionHeader title={t('settings.about')} />
    <Glass variant="base" radius={sawaaRadius.lg}>
      {rows.map(({ icon: Icon, label, value }, index) => <View key={label}
        style={[styles.row, { flexDirection: dir.row }, index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.teal[200] } : undefined]}>
        <View style={styles.icon}><Icon size={22} color={colors.teal[700]} strokeWidth={1.75} /></View>
        <Text style={[styles.label, { color: colors.ink[700], fontFamily: getFontName(dir.locale), textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>{label}</Text>
        <Text style={[styles.value, { color: colors.ink[900], fontFamily: getFontName(dir.locale), writingDirection: 'ltr' }]}>{value}</Text>
      </View>)}
    </Glass>
  </View>;
}
const styles = StyleSheet.create({
  section: { gap: sawaaSpacing.md, marginBottom: sawaaSpacing.xl },
  row: { minHeight: 56, alignItems: 'center', gap: sawaaSpacing.md, paddingHorizontal: sawaaSpacing.lg, paddingVertical: sawaaSpacing.md },
  icon: { flexShrink: 0 },
  label: { flex: 1, minWidth: 0, fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  value: { flexShrink: 1, fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
});
