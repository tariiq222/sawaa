import React, { useMemo, useState } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  LogOut,
  Phone as PhoneIcon,
  Settings,
  Ticket,
  User,
  UsersRound,
  type LucideIcon,
} from 'lucide-react-native';

import { AquaBackground, sawaaRadius, sawaaType, withAlpha } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { useAppSelector } from '@/hooks/use-redux';
import { authService } from '@/services/auth';
import { getFontName } from '@/theme/fonts';
import { useBranding, useSummary } from '@/hooks/queries';
import { AppButton } from '@/components/ui/AppButton';
import { ThemedText } from '@/theme/components/ThemedText';
import { goBackOrHome } from '@/lib/navigation';
import { useTheme } from '@/theme/useTheme';
import { formatCurrencyAmount } from '@/lib/currency-display';

function formatLastVisit(iso: string | null, isRTL: boolean): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(isRTL ? 'ar-SA' : 'en-US', { calendar: 'gregory', day: 'numeric', month: 'short' }).format(new Date(iso));
}

type Row = { key: string; icon: LucideIcon; label: string; hint?: string; onPress: () => void };

export default function ProfileScreen({ asTab = false }: { asTab?: boolean }) {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const { theme } = useTheme();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const { t } = useTranslation();
  const summaryQuery = useSummary();
  const summary = summaryQuery.data ?? null;
  const brandingQuery = useBranding();
  const contactPhone = brandingQuery.data?.contactPhone ?? null;
  const [refreshing, setRefreshing] = useState(false);
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email
    : '—';
  const secondary = user?.phone || user?.email || '';

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await summaryQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const stats: Array<{ key: string; value: string; label: string }> = [
    {
      key: 'sessions',
      value: summary
        ? (dir.isRTL ? summary.totalBookings.toLocaleString('ar-SA') : String(summary.totalBookings))
        : '—',
      label: t('profile.sessions'),
    },
    {
      key: 'lastVisit',
      value: summary ? formatLastVisit(summary.lastVisit, dir.isRTL) : '—',
      label: t('profile.lastVisit'),
    },
    {
      key: 'outstanding',
      // outstandingBalance is integer halalas.
      value: summary ? formatCurrencyAmount(summary.outstandingBalance, 'SAR', dir.isRTL) : '—',
      label: t('profile.outstanding'),
    },
  ];

  const careRows: Row[] = [
    { key: 'packages', icon: Ticket, label: t('packages.title'), onPress: () => router.push('/(client)/packages') },
    { key: 'groups', icon: UsersRound, label: t('groups.title'), onPress: () => router.push('/(client)/groups') },
    { key: 'records', icon: ClipboardList, label: t('tabs.records'), onPress: () => router.push('/(client)/records') },
  ];
  const appRows: Row[] = [
    { key: 'notifications', icon: Bell, label: t('profile.notifications'), onPress: () => router.push('/(client)/notifications') },
    { key: 'settings', icon: Settings, label: t('settings.title'), hint: t('profile.settingsHint'), onPress: () => router.push('/(client)/settings') },
  ];

  const renderGroup = (rows: Row[]) => (
    <Glass variant="strong" radius={sawaaRadius.lg} style={styles.group}>
      {rows.map((row, index) => {
        const Icon = row.icon;
        return (
          <Pressable
            key={row.key}
            onPress={row.onPress}
            accessibilityRole="button"
            style={[
              styles.row,
              { flexDirection: dir.row },
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.ink[400] },
            ]}
          >
            <Icon size={22} color={colors.teal[700]} strokeWidth={1.75} />
            <Text style={[styles.rowLabel, { fontFamily: f600, textAlign: dir.textAlign }]}>{row.label}</Text>
            {row.hint ? <Text style={[styles.rowHint, { fontFamily: f400 }]}>{row.hint}</Text> : null}
            <Chevron size={18} color={colors.ink[500]} strokeWidth={2} />
          </Pressable>
        );
      })}
    </Glass>
  );

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + (asTab ? 24 : 12), paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal[600]} />}
      >
        {asTab ? (
          <Text accessibilityRole="header" style={[styles.pageTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
            {t('profile.title')}
          </Text>
        ) : (
          <ScreenHeader title={t('profile.title')} onBack={() => goBackOrHome(router, '/(client)/(tabs)/account')} />
        )}

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(500).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.lg} style={styles.profileCard}>
            <View style={[styles.profileRow, { flexDirection: dir.row }]}>
              <View style={styles.avatar}>
                <User size={30} color={colors.teal[700]} strokeWidth={1.75} />
              </View>
              <View style={styles.profileMid}>
                <Text style={[styles.profileName, { fontFamily: f700, textAlign: dir.textAlign }]}>
                  {displayName}
                </Text>
                <Text style={[styles.profileMeta, { fontFamily: f400, textAlign: 'left', writingDirection: 'ltr' }]}>
                  {secondary}
                </Text>
              </View>
              <AppButton label={t('profile.edit')} variant="ghost" size="sm" minHeight={44}
                onPress={() => router.push('/(client)/settings-profile')} style={styles.editBtn} />
            </View>

            {!summary && summaryQuery.isPending ? <View accessibilityLiveRegion="polite" style={styles.summaryStatus}>
              <ActivityIndicator color={colors.teal[700]} /><ThemedText>{t('common.loading')}</ThemedText>
            </View> : (<View style={[styles.statsRow, { flexDirection: dir.row }]}>
              {stats.map((s) => (
                <View key={s.key} style={styles.statBox}>
                  <Text style={[styles.statN, { fontFamily: f700, writingDirection: s.key === 'lastVisit' ? dir.writingDirection : 'ltr', textAlign: 'center' }]}>{s.value}</Text>
                  <Text style={[styles.statL, { fontFamily: f400 }]}>{s.label}</Text>
                </View>
              ))}
            </View>)}
            {summaryQuery.isError ? <View style={styles.summaryStatus}>
              <ThemedText accessibilityRole="alert" color={theme.colors.error}>{t('profile.summaryLoadError')}</ThemedText>
              <AppButton label={t('common.retry')} variant="ghost" size="sm" onPress={() => void summaryQuery.refetch()} />
            </View> : null}
          </Glass>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(80).duration(500).easing(Easing.out(Easing.cubic))}>
          {renderGroup(careRows)}
        </Animated.View>
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(140).duration(500).easing(Easing.out(Easing.cubic))}>
          {renderGroup(appRows)}
        </Animated.View>

        {contactPhone ? (
          <Glass
            variant="strong"
            radius={sawaaRadius.lg}
            style={styles.sosCard}
            onPress={() => void Linking.openURL(`tel:${contactPhone}`)}
            interactive
          >
            <View style={[styles.sosRow, { flexDirection: dir.row }]}>
              <PhoneIcon size={22} color={colors.accent.coral} strokeWidth={1.75} />
              <View style={styles.profileMid}>
                <Text style={[styles.rowLabel, { fontFamily: f700, textAlign: dir.textAlign }]}>
                  {t('profile.crisisSupport.title')}
                </Text>
                <Text style={[styles.profileMeta, { fontFamily: f400, textAlign: dir.textAlign }]}>
                  {t('profile.crisisSupport.subtitle')}
                </Text>
              </View>
              <Text style={[styles.sosPhone, { fontFamily: f700 }]}>{contactPhone}</Text>
            </View>
          </Glass>
        ) : null}

        <Glass
          variant="strong"
          radius={sawaaRadius.lg}
          onPress={() => { void authService.logout().then(() => router.replace('/(guest)/home')); }}
          interactive
          accessibilityRole="button"
          style={styles.group}
        >
          <View style={[styles.row, { flexDirection: dir.row }]}>
            <LogOut size={22} color={colors.accent.coral} strokeWidth={1.75} />
            <Text style={[styles.rowLabel, { fontFamily: f600, textAlign: dir.textAlign }]}>{t('profile.signOut')}</Text>
          </View>
        </Glass>
      </ScrollView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 16 },
  pageTitle: { fontSize: sawaaType.heading.fontSize, lineHeight: sawaaType.heading.lineHeight, color: colors.ink[900] },
  profileCard: { padding: 16 },
  profileRow: { alignItems: 'center', gap: 14 },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.teal[100],
  },
  profileMid: { flex: 1, minWidth: 0 },
  profileName: { fontSize: sawaaType.subheading.fontSize, lineHeight: sawaaType.subheading.lineHeight, color: colors.ink[900] },
  profileMeta: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[700] },
  editBtn: { alignSelf: 'center', minWidth: 68, maxWidth: '40%' },
  summaryStatus: { marginTop: 16, gap: 8, alignItems: 'center' },
  statsRow: { marginTop: 16, gap: 8 },
  statBox: {
    flex: 1, minWidth: 0, flexShrink: 1,
    paddingVertical: 10,
    borderRadius: sawaaRadius.md,
    backgroundColor: withAlpha(colors.teal[500], 0.08),
    alignItems: 'center',
  },
  statN: { fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.teal[700] },
  statL: { fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight, color: colors.ink[700], marginTop: 2 },
  group: { padding: 0 },
  row: { alignItems: 'center', gap: 14, paddingHorizontal: 16, minHeight: 56 },
  rowLabel: { flex: 1, minWidth: 0, flexShrink: 1, fontSize: sawaaType.body.fontSize, lineHeight: sawaaType.body.lineHeight, color: colors.ink[900] },
  rowHint: { flexShrink: 1, maxWidth: '45%', fontSize: sawaaType.caption.fontSize, lineHeight: sawaaType.caption.lineHeight, color: colors.ink[700] },
  sosCard: { padding: 16 },
  sosRow: { alignItems: 'center', gap: 14 },
  sosPhone: { flexShrink: 1, writingDirection: 'ltr', fontSize: sawaaType.body.fontSize, color: colors.ink[900] },
});
