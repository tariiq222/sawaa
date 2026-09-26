import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react-native';
import { Glass } from '@/theme/components/Glass';
import { AppIcon } from '@/components/ui/AppIcon';
import { useDir } from '@/hooks/useDir';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { getFontName } from '@/theme/fonts';
import { useTranslation } from 'react-i18next';

interface HomeSectionHeadingProps {
  title: string;
  symbol: React.ComponentProps<typeof AppIcon>['sf'];
  icon: LucideIcon;
  onSeeAll?: () => void;
}

export function HomeSectionHeading({ title, symbol, icon, onSeeAll }: HomeSectionHeadingProps) {
  const dir = useDir();
  const colors = useSawaaColors();
  const { t } = useTranslation();
  const bold = getFontName(dir.locale, '700');
  return (
    <View style={[styles.row, { flexDirection: dir.row }]}>
      <Glass variant="strong" radius={16} style={styles.icon}>
        <AppIcon sf={symbol} fallback={icon} size={21} color={colors.teal[700]} />
      </Glass>
      <Text accessibilityRole="header" style={[styles.title, { fontFamily: bold, color: colors.ink[900], textAlign: dir.textAlign }]}>{title}</Text>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} accessibilityRole="button" accessibilityLabel={`${title} — ${t('home.seeAll')}`} style={styles.more}>
          <AppIcon sf={dir.isRTL ? 'chevron.left' : 'chevron.right'} fallback={dir.isRTL ? ChevronLeft : ChevronRight} size={19} color={colors.teal[700]} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  icon: { width: 40, height: 40, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 17, lineHeight: 24, fontWeight: '700' },
  more: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
