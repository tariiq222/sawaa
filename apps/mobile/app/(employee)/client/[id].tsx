import { useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { View, ScrollView, Pressable, Linking, StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Mail, Phone } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/theme/components/Glass';
import {
  AquaBackground,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
} from '@/theme/sawaa';
import { Pill } from '@/components/ui/Pill';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Thumb } from '@/components/ui/Thumb';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { useEmployeeClient, useEmployeeClientHistory } from '@/hooks/queries/useEmployeeClient';
import { getStatusLabel } from '@/lib/status-helpers';

export default function DoctorClientRecordScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');

  const record = useEmployeeClient(id);
  const history = useEmployeeClientHistory(id);
  const loadFailed = record.isError || history.isError;
  const client = record.data;
  const visits = history.data ?? [];
  const retry = () => { void record.refetch(); void history.refetch(); };

  if (id && !loadFailed && (record.isPending || history.isPending)) {
    return (
      <AquaBackground>
        <View style={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.md }]}>
          <Skeleton width={44} height={44} radius={sawaaRadius.pill} style={styles.loaderBlock} />
          <Skeleton width="50%" height={24} radius={sawaaRadius.sm} style={styles.loaderBlock} />
          <Skeleton height={104} radius={sawaaRadius.xl} style={styles.loaderBlock} />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={68} radius={sawaaRadius.lg} style={styles.loaderRow} />
          ))}
        </View>
      </AquaBackground>
    );
  }

  if (loadFailed || !client) {
    return (
      <AquaBackground>
        <View style={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.md }]}>
          <ScreenHeader title={t('doctor.clientRecord')} onBack={() => router.back()} />
          <View style={styles.centered}>
            {loadFailed ? (
              <ErrorState onRetry={retry} />
            ) : (
              <EmptyState
                icon="alert-circle-outline"
                tone="danger"
                title={t('doctor.clientNotFound')}
                actionLabel={t('common.back')}
                onAction={() => router.back()}
              />
            )}
          </View>
        </View>
      </AquaBackground>
    );
  }

  const fullName = client.name || [client.firstName, client.lastName].filter(Boolean).join(' ');
  const locale = dir.isRTL ? 'ar-SA' : 'en-US';
  const textStyle = { textAlign: dir.textAlign, writingDirection: dir.writingDirection } as const;
  const contactRows = [
    client.phone ? { key: 'phone', Icon: Phone, value: client.phone, url: `tel:${client.phone}` } : null,
    client.email ? { key: 'email', Icon: Mail, value: client.email, url: `mailto:${client.email}` } : null,
  ].filter((row): row is NonNullable<typeof row> => row !== null);

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + sawaaSpacing.md, paddingBottom: insets.bottom + sawaaSpacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={t('doctor.clientRecord')} onBack={() => router.back()} />

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(100).duration(600).easing(Easing.out(Easing.cubic))}>
          <Glass variant="base" radius={sawaaRadius.xl} padding={sawaaSpacing.lg}>
            <View style={[styles.profileRow, { flexDirection: dir.row }]}>
              <Thumb uri={client.avatarUrl} width={64} height={64} radius={sawaaRadius.pill} />
              <View style={styles.profileMid}>
                <Text numberOfLines={2} style={[styles.profileName, textStyle, { fontFamily: f700 }]}>
                  {fullName}
                </Text>
                {visits.length > 0 ? (
                  <View style={{ alignSelf: dir.alignStart }}>
                    <Pill label={`${visits.length} ${t('doctor.visits')}`} />
                  </View>
                ) : null}
              </View>
            </View>
            {contactRows.length > 0 ? (
              <View style={styles.contactList}>
                {contactRows.map(({ key, Icon, value, url }) => (
                  <Pressable
                    key={key}
                    onPress={() => Linking.openURL(url)}
                    accessibilityRole="button"
                    accessibilityLabel={value}
                    style={[styles.contactRow, { flexDirection: dir.row }]}
                  >
                    <Icon size={22} strokeWidth={1.75} color={colors.teal[700]} />
                    <Text style={[styles.contactText, textStyle, { fontFamily: f400 }]}>{value}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </Glass>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(180).duration(600).easing(Easing.out(Easing.cubic))}>
          <SectionHeader title={t('doctor.visitHistory')} />
        </Animated.View>

        {visits.length === 0 ? (
          <EmptyState icon="calendar-outline" title={t('common.noResults')} />
        ) : (
          <View style={styles.visitList}>
            {visits.map((v, index) => {
              const when = new Date(v.scheduledAt);
              const dateLabel = when.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
              const timeLabel = when.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
              return (
                <Animated.View
                  key={v.id}
                  entering={reduceMotion ? undefined : FadeInDown.delay(240 + index * 70).duration(600).easing(Easing.out(Easing.cubic))}
                >
                  <Glass variant="base" radius={sawaaRadius.lg}>
                    <Pressable
                      onPress={() => router.push(`/(employee)/appointment/${v.id}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`${dateLabel} ${timeLabel} ${t(getStatusLabel(v.status))}`}
                      style={({ pressed }) => [styles.visitRow, { flexDirection: dir.row, opacity: pressed ? 0.7 : 1 }]}
                    >
                      <View style={[styles.visitIcon, { backgroundColor: colors.teal[100] }]}>
                        <CalendarDays size={22} strokeWidth={1.75} color={colors.teal[700]} />
                      </View>
                      <View style={styles.visitMid}>
                        <Text numberOfLines={1} style={[styles.visitTitle, textStyle, { fontFamily: f700 }]}>
                          {dateLabel} · {timeLabel}
                        </Text>
                        <Text style={[styles.visitSub, textStyle, { fontFamily: f400 }]}>
                          {t(v.deliveryType === 'online' ? 'doctor.deliveryOnline' : 'doctor.deliveryInPerson')}
                        </Text>
                      </View>
                      <StatusPill status={v.status} label={t(getStatusLabel(v.status))} />
                    </Pressable>
                  </Glass>
                </Animated.View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: sawaaSpacing.lg, gap: sawaaSpacing.lg },
  centered: { flex: 1, justifyContent: 'center' },
  loaderBlock: { marginBottom: sawaaSpacing.md },
  loaderRow: { marginBottom: sawaaSpacing.sm },
  profileRow: { alignItems: 'center', gap: sawaaSpacing.lg },
  profileMid: { flex: 1, gap: sawaaSpacing.sm },
  profileName: {
    fontSize: sawaaType.subheading.fontSize + 2,
    lineHeight: sawaaType.subheading.lineHeight + 2,
    color: colors.ink[900],
  },
  contactList: {
    marginTop: sawaaSpacing.lg,
    paddingTop: sawaaSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.ink[400],
  },
  contactRow: { alignItems: 'center', gap: sawaaSpacing.md, minHeight: 44 },
  contactText: {
    flex: 1,
    fontSize: 15,
    lineHeight: sawaaType.body.lineHeight + 2,
    color: colors.ink[900],
  },
  visitList: { gap: sawaaSpacing.sm },
  visitRow: { alignItems: 'center', gap: sawaaSpacing.md, padding: sawaaSpacing.md, minHeight: 68 },
  visitIcon: { width: 44, height: 44, borderRadius: sawaaRadius.md, alignItems: 'center', justifyContent: 'center' },
  visitMid: { flex: 1, gap: 2 },
  visitTitle: {
    fontSize: 15,
    lineHeight: sawaaType.subheading.lineHeight,
    color: colors.ink[900],
  },
  visitSub: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[700],
  },
});
