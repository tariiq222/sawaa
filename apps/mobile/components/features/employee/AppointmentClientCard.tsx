import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { Glass } from '@/theme/components/Glass';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { StatusPill } from '@/components/ui/StatusPill';
import { Thumb } from '@/components/ui/Thumb';
import { useDir } from '@/hooks/useDir';
import { getFontName } from '@/theme/fonts';

interface AppointmentClientCardProps {
  name: string;
  avatarUrl?: string | null;
  status: string;
  statusLabel: string;
  /** Opens the client record. Omit when the booking carries no client. */
  onPress?: () => void;
}

/** Client card at the top of the staff appointment detail; tapping it opens the client record. */
export function AppointmentClientCard({ name, avatarUrl, status, statusLabel, onPress }: AppointmentClientCardProps) {
  const colors = useSawaaColors();
  const { t } = useTranslation();
  const dir = useDir();
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;
  const textStyle = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  return (
    <Glass variant="base" radius={sawaaRadius.xl}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${name} ${t('doctor.viewClientRecord')}`}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [styles.row, { flexDirection: dir.row, opacity: pressed ? 0.7 : 1 }]}
      >
        <Thumb uri={avatarUrl} width={56} height={56} radius={sawaaRadius.pill} />
        <View style={styles.mid}>
          <Text style={[styles.name, textStyle, { color: colors.ink[900], fontFamily: getFontName(dir.locale, '700') }]}>
            {name}
          </Text>
          {onPress ? (
            <Text style={[styles.link, textStyle, { color: colors.teal[700], fontFamily: getFontName(dir.locale, '400') }]}>
              {t('doctor.viewClientRecord')}
            </Text>
          ) : null}
        </View>
        <View style={styles.status}><StatusPill status={status} label={statusLabel} /></View>
        {onPress ? <Chevron size={20} color={colors.ink[500]} strokeWidth={1.75} /> : null}
      </Pressable>
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { flexWrap: 'wrap', alignItems: 'center', gap: sawaaSpacing.md, padding: sawaaSpacing.lg },
  status: { minWidth: 0, flexShrink: 1, maxWidth: '100%' },
  mid: { flexGrow: 1, flexBasis: 120, minWidth: 0, flexShrink: 1, gap: 2 },
  name: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  link: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
});
