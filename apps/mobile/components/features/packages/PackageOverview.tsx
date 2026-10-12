import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';

import { SectionHeader } from '@/components/ui/SectionHeader';
import { useDir } from '@/hooks/useDir';
import { formatCurrencyAmount } from '@/lib/currency-display';
import { packageGrossHalalas, packageVatHalalas, packageVatRate } from '@/lib/package-vat';
import type { ClientPackageFamily } from '@/services/client/packages';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

interface PackageOverviewProps {
  family: ClientPackageFamily;
  /** The chosen option; only used when the family offers more than one. */
  selectedOptionId?: string;
  onSelectOption?: (optionId: string) => void;
}

/**
 * Package overview: image, name and description, how a package works, then
 * every option with its price, VAT note, session count and what each session
 * group contains (service, practitioner, durations). With more than one option
 * and an `onSelectOption` handler the options render as selectable radios.
 */
export function PackageOverview({ family, selectedOptionId, onSelectOption }: PackageOverviewProps) {
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const vatRate = packageVatRate(family);
  const localName = (candidate: { nameAr: string; nameEn?: string | null }) => (dir.isRTL ? candidate.nameAr : candidate.nameEn ?? candidate.nameAr);
  const description = (dir.isRTL ? family.descriptionAr : family.descriptionEn ?? family.descriptionAr)?.trim();
  const selectable = family.options.length > 1 && Boolean(onSelectOption);

  return (
    <View style={styles.wrap}>
      <Glass variant="strong" radius={sawaaRadius.xl} style={styles.hero}>
        {family.imageUrl ? <Image source={{ uri: family.imageUrl }} resizeMode="cover" style={styles.image} /> : null}
        <Text style={[styles.title, { color: colors.ink[900], fontFamily: f700, textAlign: dir.textAlign }]}>{localName(family)}</Text>
        {description ? (
          <Text style={[styles.body, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>{description}</Text>
        ) : null}
        <Text style={[styles.hint, { color: colors.ink[500], fontFamily: f400, textAlign: dir.textAlign }]}>{t('packages.intro')}</Text>
      </Glass>

      <SectionHeader title={t(family.options.length > 1 ? 'packages.optionsTitle' : 'packages.optionTitle')} />
      {family.options.map((option) => {
        const net = option.price.finalPrice;
        const groups = option.displayGroups?.length ? option.displayGroups : (option.groups ?? []).map((group) => ({
          key: group.key,
          label: group.label,
          serviceNameAr: '',
          serviceNameEn: null,
          employeeName: '',
          sessions: group.sessions.map((session, position) => ({ position, durationMins: 0, deliveryType: session.deliveryType })),
        }));
        const selected = selectable && option.id === selectedOptionId;
        return (
          <Glass
            key={option.id}
            radius={sawaaRadius.lg}
            style={[styles.option, selected && { borderWidth: 2, borderColor: colors.teal[600] }]}
            {...(selectable ? {
              onPress: () => onSelectOption?.(option.id),
              accessibilityLabel: localName(option),
              accessibilityRole: 'radio' as const,
              accessibilityState: { selected },
            } : {})}
          >
            <View style={[styles.optionRow, { flexDirection: dir.row }]}>
              <Text style={[styles.optionName, { color: colors.ink[900], fontFamily: f700, textAlign: dir.textAlign }]}>{localName(option)}</Text>
              <Text style={[styles.optionPrice, { color: colors.teal[700], fontFamily: f700 }]}>{formatCurrencyAmount(packageGrossHalalas(net, vatRate), 'SAR', dir.isRTL)}</Text>
            </View>
            {vatRate > 0 ? (
              <Text style={[styles.meta, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>
                {t('packages.vatIncluded')} · {t('packages.vatBreakdown', {
                  net: formatCurrencyAmount(net, 'SAR', dir.isRTL),
                  vat: formatCurrencyAmount(packageVatHalalas(net, vatRate), 'SAR', dir.isRTL),
                })}
              </Text>
            ) : null}
            <View style={[styles.check, { flexDirection: dir.row }]}>
              <Check size={18} color={colors.teal[700]} strokeWidth={2.25} />
              <Text style={[styles.meta, { flex: 1, color: colors.ink[900], fontFamily: f400, textAlign: dir.textAlign }]}>{t('packages.sessionCount', { count: option.sessionCount })}</Text>
            </View>
            {groups.map((group) => (
              <View key={group.key} style={[styles.group, { borderTopColor: colors.ink[400] }]}>
                <Text style={[styles.meta, { color: colors.ink[700], fontFamily: f600, textAlign: dir.textAlign }]}>
                  {group.label || t('packages.groupLabel', { key: group.key })}
                </Text>
                <Text style={[styles.meta, { color: colors.ink[700], fontFamily: f400, textAlign: dir.textAlign }]}>
                  {group.serviceNameAr || group.serviceNameEn
                    ? t('packages.groupComposition', {
                      sessions: group.sessions.length,
                      service: dir.isRTL ? group.serviceNameAr : group.serviceNameEn ?? group.serviceNameAr,
                      practitioner: group.employeeName,
                      durations: group.sessions.map((session) => session.durationMins > 0
                        ? t('packages.durationMinutes', { minutes: session.durationMins, delivery: session.deliveryType === 'ONLINE' ? t('packages.online') : t('packages.inPerson') })
                        : t('packages.sessionIncluded')).join(', '),
                    })
                    : t('packages.groupFallback', { sessions: group.sessions.length })}
                </Text>
              </View>
            ))}
          </Glass>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: sawaaSpacing.md },
  hero: { padding: sawaaSpacing.lg, gap: sawaaSpacing.sm },
  image: { width: '100%', height: 160, borderRadius: sawaaRadius.lg, marginBottom: sawaaSpacing.xs },
  title: { fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight },
  body: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  hint: { fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight },
  option: { padding: sawaaSpacing.lg, gap: sawaaSpacing.sm },
  optionRow: { alignItems: 'center', justifyContent: 'space-between', gap: sawaaSpacing.md },
  optionName: { flex: 1, minWidth: 0, fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  optionPrice: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  meta: { fontSize: sawaaType.bodySm.fontSize, lineHeight: sawaaType.bodySm.lineHeight },
  check: { alignItems: 'center', gap: 8 },
  group: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: sawaaSpacing.sm, gap: 2 },
});
