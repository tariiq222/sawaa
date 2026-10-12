import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CalendarDays, CalendarRange, Clock, Users, Wallet, type LucideIcon } from 'lucide-react-native';

import { InfoRows, type InfoRow } from '@/components/ui/InfoRows';
import { Pill } from '@/components/ui/Pill';
import { useDir } from '@/hooks/useDir';
import { formatHalalasPrice, formatWeekdayDateTime } from '@/lib/session-format';
import type { Program } from '@/services/client/group-sessions';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

/**
 * Everything a reader needs about a support group before deciding: name, seats
 * pill, public description, then every known fact as a row (date, days, hours
 * per day, duration, participants, price, deposit). Rows with no data are left
 * out rather than shown empty.
 */
export function GroupOverview({ group }: { group: Program }) {
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');
  const name = dir.isRTL ? group.nameAr : group.nameEn ?? group.nameAr;
  // Public copy wins; the internal description is only a fallback.
  const description = (dir.isRTL
    ? group.publicDescriptionAr ?? group.descriptionAr
    : group.publicDescriptionEn ?? group.descriptionEn ?? group.publicDescriptionAr ?? group.descriptionAr)?.trim();
  const when = formatWeekdayDateTime(group.scheduledAt ?? group.startDate, dir.isRTL);
  const max = group.maxCapacity ?? group.maxParticipants;
  const number = (value: number) => new Intl.NumberFormat(dir.isRTL ? 'ar-SA' : 'en-US').format(value);

  const rows: (InfoRow | null)[] = [
    { icon: CalendarDays, label: t('groups.dateLabel'), value: when ?? t('groups.dateTba') },
    group.daysCount > 0 ? { icon: CalendarRange, label: t('groups.daysLabel'), value: number(group.daysCount) } : null,
    group.hoursPerDay > 0 ? { icon: Clock, label: t('groups.hoursPerDayLabel'), value: number(group.hoursPerDay) } : null,
    group.durationMins ? { icon: Clock, label: t('groups.durationLabel'), value: t('groups.duration', { count: group.durationMins }) } : null,
    { icon: Users, label: t('groups.enrolledLabel'), value: t('groups.enrolled', { count: group.enrolledCount, max }) },
    { icon: Wallet, label: t('groups.priceLabel'), value: formatHalalasPrice(group.price, dir.isRTL, t('home.sar')) },
    group.depositEnabled && group.depositAmount
      ? { icon: Wallet as LucideIcon, label: t('groups.depositLabel'), value: formatHalalasPrice(group.depositAmount, dir.isRTL, t('home.sar')) }
      : null,
  ];

  return (
    <View style={styles.wrap}>
      <Glass variant="strong" radius={sawaaRadius.xl} style={styles.hero}>
        <View style={[styles.heroTop, { flexDirection: dir.row }]}>
          <Text style={[styles.heroTitle, { color: colors.ink[900], fontFamily: f700, textAlign: dir.textAlign }]}>{name}</Text>
          <Pill tone={group.isFull ? 'muted' : 'brand'} label={group.isFull ? t('groups.full') : t('groups.spotsLeft', { count: group.spotsLeft })} />
        </View>
        {description ? (
          <Text style={[styles.description, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>{description}</Text>
        ) : null}
      </Glass>
      <InfoRows layout="stacked" rows={rows.filter((row): row is InfoRow => row !== null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: sawaaSpacing.lg },
  hero: { padding: sawaaSpacing.lg, gap: sawaaSpacing.md },
  heroTop: { alignItems: 'flex-start', justifyContent: 'space-between', gap: sawaaSpacing.md },
  heroTitle: { flex: 1, fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  description: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
});
