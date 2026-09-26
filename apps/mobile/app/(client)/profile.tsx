import React, { useMemo, useState } from 'react';
import { useTheme } from '@/theme/useTheme';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Lock,
  Moon,
  Phone as PhoneIcon,
  Settings,
  Ticket,
} from 'lucide-react-native';

import { AquaBackground, sawaaRadius, withAlpha } from '@/theme/sawaa';
import { Glass } from '@/theme/components/Glass';
import { useDir } from '@/hooks/useDir';
import { useAppSelector } from '@/hooks/use-redux';
import { authService } from '@/services/auth';
import { getFontName } from '@/theme/fonts';
import { useBranding, useSummary } from '@/hooks/queries';
import { formatHalalas } from '@/lib/money';
import { PRIVACY_POLICY_URL } from '@/constants/config';
import { DeleteAccountButton } from '@/components/features/settings/DeleteAccountButton';

const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatLastVisit(iso: string | null, isRTL: boolean): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const month = isRTL ? MONTHS_AR[d.getMonth()] : MONTHS_EN[d.getMonth()];
  const day = isRTL ? d.getDate().toLocaleString('ar-SA') : d.getDate();
  return `${day} ${month}`;
}

export default function ProfileScreen({ asTab = false }: { asTab?: boolean }) {
  const colors = useSawaaColors();
  const { theme, scheme, setThemeMode } = useTheme();
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);
  const insets = useSafeAreaInsets();
  const dir = useDir();
  const router = useRouter();
  const user = useAppSelector((s) => s.auth.user);
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');
  const { t } = useTranslation();
  const darkMode = scheme === 'dark';
  const moneyLocale = dir.isRTL ? 'ar-SA' : 'en-US';
  const summaryQuery = useSummary();
  const summary = summaryQuery.data ?? null;
  const brandingQuery = useBranding();
  const contactPhone = brandingQuery.data?.contactPhone ?? null;
  const [refreshing, setRefreshing] = useState(false);
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;
  // Pushed outside the tab group, so this screen owns its way back.
  const BackIcon = dir.isRTL ? ChevronRight : ChevronLeft;

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email
    : '—';
  const email = user?.email ?? '';
  const initial = (user?.firstName ?? '·').charAt(0);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await summaryQuery.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const stats: Array<{ value: string; ar: string; en: string }> = [
    {
      value: summary
        ? (dir.isRTL ? summary.totalBookings.toLocaleString('ar-SA') : String(summary.totalBookings))
        : '—',
      ar: 'جلسة',
      en: 'Sessions',
    },
    {
      value: summary ? formatLastVisit(summary.lastVisit, dir.isRTL) : '—',
      ar: 'آخر زيارة',
      en: 'Last visit',
    },
    {
      // outstandingBalance is integer halalas; formatHalalas renders it as SAR.
      value: summary ? `${formatHalalas(summary.outstandingBalance, { locale: moneyLocale })} ⃁` : '—',
      ar: 'مبلغ مستحق',
      en: 'Outstanding',
    },
  ];

  type SettingItem = {
    icon: React.ReactNode;
    label: { ar: string; en: string };
    color: string;
    meta?: { ar: string; en: string };
    toggle?: boolean;
    onToggle?: () => void;
    onPress?: () => void;
  };

  const settingsItems: SettingItem[] = [
    { icon: <Ticket size={18} color={colors.teal[600]} strokeWidth={1.75} />, label: { ar: t('packages.balance'), en: t('packages.balance') }, color: colors.teal[600], onPress: () => router.push('/(client)/packages/purchases') },
    { icon: <Lock size={18} color={colors.teal[600]} strokeWidth={1.75} />, label: { ar: t('settings.privacySecurity'), en: t('settings.privacySecurity') }, color: colors.teal[600], onPress: () => Linking.openURL(PRIVACY_POLICY_URL) },
    { icon: <Bell size={18} color={colors.accent.violet} strokeWidth={1.75} />, label: { ar: t('settings.pushNotifications'), en: t('settings.pushNotifications') }, color: colors.accent.violet, onPress: () => router.push('/(client)/settings-notifications') },
    { icon: <Moon size={18} color={colors.ink[700]} strokeWidth={1.75} />, label: { ar: t('settings.darkMode'), en: t('settings.darkMode') }, color: colors.ink[700], toggle: darkMode, onToggle: () => setThemeMode(darkMode ? 'light' : 'dark') },
    { icon: <Settings size={18} color={colors.ink[500]} strokeWidth={1.75} />, label: { ar: t('settings.title'), en: t('settings.title') }, color: colors.ink[500], onPress: () => router.push('/(client)/settings') },
  ];

  return (
    <AquaBackground>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: 140 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.teal[600]} />}
      >
        <Animated.View entering={FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <View style={[styles.titleRow, { flexDirection: dir.row }]}>
            {!asTab ? (
              <Glass
                variant="regular"
                radius={21}
                onPress={() => router.back()}
                interactive
                accessibilityLabel={t('a11y.buttonBack')}
                style={styles.backBtn}
              >
                <BackIcon size={20} color={colors.ink[700]} strokeWidth={1.75} />
              </Glass>
            ) : null}
            <Text style={[styles.pageTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
              {t('profile.title')}
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.profileCard}>
            <View style={[styles.profileRow, { flexDirection: dir.row }]}>
              <LinearGradient
                colors={theme.colors.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={[styles.avatarText, { fontFamily: f700 }]}>{initial}</Text>
              </LinearGradient>
              <View style={styles.profileMid}>
                <Text style={[styles.profileName, { fontFamily: f700, textAlign: dir.textAlign }]}>
                  {displayName}
                </Text>
                <Text style={[styles.profileEmail, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
                  {email}
                </Text>
                {summary && summary.totalBookings > 0 ? (
                  <View style={[styles.membership, { flexDirection: dir.row }]}>
                    <Leaf size={11} color={colors.teal[700]} strokeWidth={2} />
                    <Text style={[styles.membershipText, { fontFamily: f600, fontWeight: '600' }]}>
                      {dir.isRTL
                        ? `${summary.totalBookings.toLocaleString('ar-SA')} جلسة سابقة`
                        : `${summary.totalBookings} past session${summary.totalBookings === 1 ? '' : 's'}`}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Glass variant="regular" radius={14} onPress={() => router.push('/(client)/settings-profile')} interactive style={styles.editBtn}>
                <Text style={[styles.editText, { fontFamily: f600, fontWeight: '600' }]}>
                  {t('profile.edit')}
                </Text>
              </Glass>
            </View>

            <View style={[styles.statsRow, { flexDirection: dir.row }]}>
              {stats.map((s) => (
                <View key={s.en} style={styles.statBox}>
                  <Text style={[styles.statN, { fontFamily: f700 }]} numberOfLines={1}>
                    {s.value}
                  </Text>
                  <Text style={[styles.statL, { fontFamily: f400, fontWeight: '400' }]}>
                    {dir.isRTL ? s.ar : s.en}
                  </Text>
                </View>
              ))}
            </View>
          </Glass>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(220).duration(700).easing(Easing.out(Easing.cubic))}>
          <Glass variant="strong" radius={sawaaRadius.xl} style={styles.settingsCard}>
            {settingsItems.map((it, i) => (
              <Pressable
                key={it.label.en}
                onPress={it.onToggle ?? it.onPress}
                accessibilityRole={it.toggle !== undefined ? 'switch' : 'button'}
                accessibilityState={it.toggle !== undefined ? { checked: it.toggle } : undefined}
                style={[
                  styles.settingRow,
                  { flexDirection: dir.row },
                  i < settingsItems.length - 1 && styles.settingDivider,
                ]}
              >
                <View style={[styles.settingIcon, { backgroundColor: `${it.color}1e` }]}>
                  {it.icon}
                </View>
                <Text style={[styles.settingLabel, { fontFamily: f600, fontWeight: '600', textAlign: dir.textAlign }]}>
                  {dir.isRTL ? it.label.ar : it.label.en}
                </Text>
                {it.meta && (
                  <Text style={[styles.settingMeta, { fontFamily: f400, fontWeight: '400' }]}>
                    {dir.isRTL ? it.meta.ar : it.meta.en}
                  </Text>
                )}
                {it.toggle !== undefined ? (
                  <View style={[
                    styles.toggle,
                    { backgroundColor: it.toggle ? colors.teal[500] : withAlpha(colors.ink[900], 0.15) },
                  ]}>
                    <View style={[
                      styles.toggleKnob,
                      it.toggle ? styles.toggleKnobOn : styles.toggleKnobOff,
                    ]} />
                  </View>
                ) : (
                  <Chevron size={14} color={colors.ink[400]} strokeWidth={2} />
                )}
              </Pressable>
            ))}
          </Glass>
        </Animated.View>

        {contactPhone ? (
          <Animated.View entering={FadeInDown.delay(340).duration(700).easing(Easing.out(Easing.cubic))}>
            <Glass
              variant="strong"
              radius={sawaaRadius.xl}
              style={styles.sosCard}
              onPress={() => void Linking.openURL(`tel:${contactPhone}`)}
              interactive
            >
              <View style={[styles.sosRow, { flexDirection: dir.row }]}>
                <View style={styles.sosIcon}>
                  <PhoneIcon size={16} color={theme.colors.primaryForeground} strokeWidth={2} />
                </View>
                <View style={styles.sosMid}>
                  <Text style={[styles.sosTitle, { fontFamily: f700, textAlign: dir.textAlign }]}>
                    {t('profile.crisisSupport.title')}
                  </Text>
                  <Text style={[styles.sosSub, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign }]}>
                    {t('profile.crisisSupport.subtitle')}
                  </Text>
                </View>
                <Text style={[styles.sosPhone, { fontFamily: f700 }]}>{contactPhone}</Text>
              </View>
            </Glass>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(420).duration(700).easing(Easing.out(Easing.cubic))}>
          <DeleteAccountButton />
          <Glass variant="regular" radius={sawaaRadius.pill} onPress={() => { void authService.logout().then(() => router.replace('/home')); }} interactive style={styles.logoutBtn}>
            <Text style={[styles.logoutText, { fontFamily: f700 }]}>
              {t('profile.signOut')}
            </Text>
          </Glass>
        </Animated.View>
      </ScrollView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>, theme: ReturnType<typeof useTheme>['theme']) => StyleSheet.create({
  scroll: { paddingHorizontal: 16, gap: 14 },
  titleRow: { alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  backBtn: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 22, color: colors.ink[900], paddingHorizontal: 4 },
  profileCard: { padding: 18 },
  profileRow: { alignItems: 'center', gap: 14 },
  avatar: {
    width: 68, height: 68, borderRadius: 34,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.teal[600], shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  },
  avatarText: { fontSize: 26, color: theme.colors.primaryForeground },
  profileMid: { flex: 1 },
  profileName: { fontSize: 17, color: colors.ink[900] },
  profileEmail: { fontSize: 12, color: colors.ink[500], marginTop: 2 },
  membership: { alignItems: 'center', gap: 4, marginTop: 6 },
  membershipText: { fontSize: 11, color: colors.teal[700] },
  // Compact pill: the fixed height + centered content stop the Glass inner
  // `flex: 1` wrapper from stretching the button to the profile row's height.
  editBtn: {
    alignSelf: 'center',
    height: 32,
    minWidth: 68,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editText: { fontSize: 12, lineHeight: 16, color: colors.teal[700] },
  statsRow: { marginTop: 16, gap: 8 },
  statBox: {
    flex: 1, paddingVertical: 10, borderRadius: 16,
    backgroundColor: colors.glass.bg,
    borderWidth: 0.5, borderColor: colors.glass.border,
    alignItems: 'center',
  },
  statN: { fontSize: 18, color: colors.teal[700] },
  statL: { fontSize: 10.5, color: colors.ink[500], marginTop: 2 },
  settingsCard: { padding: 0 },
  settingRow: { alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  settingDivider: { borderBottomWidth: 0.5, borderBottomColor: colors.glass.border },
  settingIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  settingLabel: { flex: 1, fontSize: 13.5, color: colors.ink[900] },
  settingMeta: { fontSize: 11, color: colors.ink[500] },
  toggle: { width: 38, height: 22, borderRadius: 12, padding: 2, justifyContent: 'center' },
  toggleKnob: {
    width: 18, height: 18, borderRadius: 9, backgroundColor: theme.colors.primaryForeground,
    shadowColor: theme.colors.black, shadowOpacity: 0.2, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  toggleKnobOn: { alignSelf: 'flex-end' },
  toggleKnobOff: { alignSelf: 'flex-start' },
  sosCard: { padding: 14, backgroundColor: withAlpha(colors.accent.coral, 0.15) },
  sosRow: { alignItems: 'center', gap: 12 },
  sosIcon: {
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: theme.colors.primaryFill,
    alignItems: 'center', justifyContent: 'center',
  },
  sosMid: { flex: 1 },
  sosTitle: { fontSize: 13.5, color: colors.ink[900] },
  sosSub: { fontSize: 11, color: colors.ink[500], marginTop: 2 },
  sosPhone: { fontSize: 12, color: colors.accent.coral },
  logoutBtn: { paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  logoutText: { fontSize: 14, color: colors.accent.coral },
});
