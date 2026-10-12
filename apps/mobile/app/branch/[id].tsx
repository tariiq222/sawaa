import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MapPin, Phone } from 'lucide-react-native';

import { AppButton } from '@/components/ui/AppButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { InfoRows } from '@/components/ui/InfoRows';
import { Pill } from '@/components/ui/Pill';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePublicBranch } from '@/hooks/queries';
import { useDir } from '@/hooks/useDir';
import { goBackOrHome } from '@/lib/navigation';
import { openInMaps } from '@/lib/maps-link';
import { formatTimeOfDay, localeOf } from '@/lib/session-format';
import type { PublicBranchDetail } from '@/services/client/branches';
import { Glass } from '@/theme/components/Glass';
import { getFontName } from '@/theme/fonts';
import { AquaBackground } from '@/theme/sawaa';
import { sawaaRadius, sawaaSpacing, sawaaType } from '@/theme/sawaa/tokens';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';

/** 2024-01-07 is a Sunday, so day 0 maps to Sunday like the backend's `dayOfWeek`. */
function weekdayName(dayOfWeek: number, isRTL: boolean): string {
  const date = new Date(Date.UTC(2024, 0, 7 + dayOfWeek));
  return new Intl.DateTimeFormat(localeOf(isRTL), { weekday: 'long', timeZone: 'UTC' }).format(date);
}

function timeLabel(time: string | null, isRTL: boolean): string {
  if (!time) return '';
  const hhmm = time.slice(0, 5);
  return formatTimeOfDay(`2024-01-07T${hhmm}:00+03:00`, isRTL) ?? hhmm;
}


export default function BranchDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const dir = useDir();
  const insets = useSafeAreaInsets();
  const query = usePublicBranch(id);
  const branch = query.data;
  const name = branch ? (dir.isRTL ? branch.nameAr : branch.nameEn || branch.nameAr) : '';

  return (
    <AquaBackground>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }]}>
        <ScreenHeader title={name || t('branches.title')} onBack={() => goBackOrHome(router)} />
        {query.isLoading ? (
          <View style={styles.loading}>
            <Skeleton height={120} radius={sawaaRadius.lg} />
            <Skeleton height={200} radius={sawaaRadius.lg} />
          </View>
        ) : query.isError || !branch ? (
          <EmptyState icon="cloud-offline-outline" tone="danger" title={t('branches.loadError')} actionLabel={t('common.retry')} onAction={() => { void query.refetch(); }} />
        ) : (
          <BranchBody branch={branch} name={name} />
        )}
      </ScrollView>
    </AquaBackground>
  );
}

function BranchBody({ branch, name }: { branch: PublicBranchDetail; name: string }) {
  const { t } = useTranslation();
  const dir = useDir();
  const colors = useSawaaColors();
  const address = dir.isRTL ? branch.addressAr : branch.addressEn || branch.addressAr;
  const hours = [...branch.businessHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const text = (weight: '400' | '600' | '700') => ({
    fontFamily: getFontName(dir.locale, weight), textAlign: dir.textAlign, writingDirection: dir.writingDirection,
  });
  const hasMap = branch.latitude != null && branch.longitude != null;

  return (
    <View style={styles.body}>
      <Glass variant="strong" radius={sawaaRadius.xl} style={styles.hero}>
        <View style={[styles.heroRow, { flexDirection: dir.row }]}>
          <MapPin size={24} color={colors.teal[700]} strokeWidth={1.75} />
          <View style={[styles.heroText, { alignItems: dir.alignStart }]}>
            <Text style={[styles.heroName, { color: colors.ink[900] }, text('700')]}>{name}</Text>
            {branch.city ? <Text style={[styles.heroLine, { color: colors.ink[700] }, text('400')]}>{branch.city}</Text> : null}
            {address ? <Text style={[styles.heroLine, { color: colors.ink[700] }, text('400')]}>{address}</Text> : null}
            {branch.isMain ? <Pill label={t('branches.main')} /> : null}
          </View>
        </View>
      </Glass>

      {branch.phone ? <InfoRows rows={[{ icon: Phone, label: t('branches.phone'), value: `⁦${branch.phone}⁩` }]} /> : null}

      {hours.length > 0 ? (
        <View style={styles.hours}>
          <SectionHeader title={t('branches.hours')} />
          <Glass variant="base" radius={sawaaRadius.lg} padding={0}>
            {hours.map((day, index) => (
              <View
                key={day.dayOfWeek}
                testID={`branch-hours-${day.dayOfWeek}`}
                style={[styles.hourRow, { flexDirection: dir.row }, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.ink[400] }]}
              >
                <Text style={[styles.day, { color: colors.ink[900] }, text('600')]}>{weekdayName(day.dayOfWeek, dir.isRTL)}</Text>
                <Text style={[styles.time, { color: day.isOpen ? colors.ink[700] : colors.ink[500] }, text('400')]}>
                  {day.isOpen ? `${timeLabel(day.startTime, dir.isRTL)} - ${timeLabel(day.endTime, dir.isRTL)}` : t('branches.closed')}
                </Text>
              </View>
            ))}
          </Glass>
        </View>
      ) : null}

      {branch.phone || hasMap ? (
        <View style={styles.actions}>
          {branch.phone ? (
            <AppButton label={t('branches.call')} icon={<Phone size={20} color={colors.ink[900]} strokeWidth={1.75} />} onPress={() => { void Linking.openURL(`tel:${branch.phone}`); }} testID="branch-call" />
          ) : null}
          {hasMap ? (
            <AppButton variant="secondary" label={t('branches.openMaps')} icon={<MapPin size={20} color={colors.teal[700]} strokeWidth={1.75} />} onPress={() => { void openInMaps(branch.latitude as number, branch.longitude as number); }} testID="branch-maps" />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, gap: sawaaSpacing.lg },
  loading: { gap: sawaaSpacing.md },
  body: { gap: sawaaSpacing.lg },
  hero: { padding: sawaaSpacing.lg },
  heroRow: { alignItems: 'flex-start', gap: sawaaSpacing.md },
  heroText: { flex: 1, minWidth: 0, gap: 6 },
  heroName: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight },
  heroLine: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight },
  hours: { gap: sawaaSpacing.md },
  hourRow: { alignItems: 'center', justifyContent: 'space-between', gap: sawaaSpacing.md, paddingHorizontal: sawaaSpacing.lg, paddingVertical: sawaaSpacing.md, minHeight: 48 },
  day: { fontSize: sawaaType.body.fontSize },
  time: { fontSize: sawaaType.body.fontSize, flexShrink: 1 },
  actions: { gap: sawaaSpacing.md },
});
