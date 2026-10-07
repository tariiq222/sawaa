import Constants from 'expo-constants';
import { useCallback, useMemo } from 'react';
import { useSawaaColors } from '@/theme/sawaa/useSawaaColors';
import { Linking, View, ScrollView, Pressable, Alert, StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  Clock,
  Info,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Glass } from '@/theme/components/Glass';
import {
  AquaBackground,
  sawaaRadius,
  sawaaSpacing,
  sawaaType,
  withAlpha,
} from '@/theme/sawaa';
import { Thumb } from '@/components/ui/Thumb';
import { useDir } from '@/hooks/useDir';
import { useReduceMotion } from '@/hooks/useA11y';
import { getFontName } from '@/theme/fonts';
import { UnverifiedEmailBanner } from '@/components/features/auth/UnverifiedEmailBanner';
import { useAppSelector, useAppDispatch } from '@/hooks/use-redux';
import { logout, setUser } from '@/stores/slices/auth-slice';
import { authService } from '@/services/auth';
import { PRIVACY_POLICY_URL } from '@/constants/config';

interface MenuEntry {
  icon: React.ElementType;
  label: string;
  value?: string;
  danger?: boolean;
  onPress: () => void;
}

function MenuRow({ icon: Icon, label, value, danger, onPress }: MenuEntry) {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;
  const tint = danger ? colors.accent.coral : colors.teal[700];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.menuRow, { flexDirection: dir.row, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.menuLeft, { flexDirection: dir.row }]}>
        <Icon size={22} strokeWidth={1.75} color={tint} />
        <Text
          style={[
            styles.menuLabel,
            { fontFamily: f400, color: danger ? colors.accent.coral : colors.ink[900], writingDirection: dir.writingDirection },
          ]}
        >
          {label}
        </Text>
      </View>
      <View style={[styles.menuRight, { flexDirection: dir.row }]}>
        {value ? (
          <Text style={[styles.menuValue, { fontFamily: f400, fontWeight: '400', writingDirection: dir.writingDirection }]}>
            {value}
          </Text>
        ) : null}
        {!danger && <Chevron size={20} strokeWidth={1.75} color={colors.ink[500]} />}
      </View>
    </Pressable>
  );
}

function MenuGroup({ entries }: { entries: MenuEntry[] }) {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Glass variant="base" radius={sawaaRadius.lg} padding={sawaaSpacing.xs}>
      {entries.map((entry, i) => (
        <View key={entry.label}>
          {i > 0 && <View style={styles.divider} />}
          <MenuRow {...entry} />
        </View>
      ))}
    </Glass>
  );
}

export default function EmployeeProfileScreen() {
  const colors = useSawaaColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const user = useAppSelector((s) => s.auth.user);
  const f400 = getFontName(dir.locale, '400');
  const f700 = getFontName(dir.locale, '700');

  const version = Constants.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '1.0.0';
  const fullName = user ? `${user.firstName} ${user.lastName}` : '';

  // Refresh /auth/me when the screen gains focus, mirroring the
  // client profile behaviour from Phase 3.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      authService
        .getProfile()
        .then((res) => {
          if (cancelled || !res?.success || !res.data) return;
          dispatch(setUser(res.data));
        })
        .catch(() => {
          // Silent — Redux cache remains authoritative on failure.
        });
      return () => {
        cancelled = true;
      };
    }, [dispatch]),
  );

  const handleLogout = useCallback(() => {
    Alert.alert(t('auth.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('auth.logout'),
        style: 'destructive',
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await authService.logout();
          dispatch(logout());
          router.replace('/(guest)/home');
        },
      },
    ]);
  }, [dispatch, router, t]);

  return (
    <AquaBackground>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.lg }]}
      >
        <UnverifiedEmailBanner />
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <Text accessibilityRole="header" style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {t('employee.profile')}
          </Text>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(100).duration(600).easing(Easing.out(Easing.cubic))}>
          <Glass variant="base" radius={sawaaRadius.xl} padding={sawaaSpacing.lg} style={styles.profileCard}>
            <View style={[styles.profileRow, { flexDirection: dir.row }]}>
              <Thumb uri={user?.avatarUrl} width={64} height={64} radius={sawaaRadius.pill} />
              <View style={styles.profileMid}>
                <Text style={[styles.profileName, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                  {fullName}
                </Text>
                <Text style={[styles.profileEmail, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                  {user?.email}
                </Text>
              </View>
            </View>
          </Glass>
        </Animated.View>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(260).duration(600).easing(Easing.out(Easing.cubic))}
          style={styles.group}
        >
          <MenuGroup
            entries={[
              { icon: Clock, label: t('availability.hours'), onPress: () => router.push('/(employee)/availability') },
              { icon: Info, label: t('profile.about'), onPress: () => Alert.alert(t('common.appName'), t('profile.version', { version })) },
              { icon: Shield, label: t('profile.privacy'), onPress: () => Linking.openURL(PRIVACY_POLICY_URL) },
            ]}
          />
        </Animated.View>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(340).duration(600).easing(Easing.out(Easing.cubic))}
          style={styles.group}
        >
          <MenuGroup entries={[{ icon: LogOut, label: t('auth.logout'), danger: true, onPress: handleLogout }]} />
        </Animated.View>

        <Text style={[styles.version, { fontFamily: f400, fontWeight: '400', writingDirection: dir.writingDirection }]}>
          {t('profile.version', { version })}
        </Text>
      </ScrollView>
    </AquaBackground>
  );
}

const createStyles = (colors: ReturnType<typeof useSawaaColors>) => StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, paddingBottom: 140 },
  title: {
    fontSize: 28,
    lineHeight: 38,
    color: colors.ink[900],
    marginBottom: sawaaSpacing.xl,
  },
  profileCard: { marginBottom: sawaaSpacing.lg },
  profileRow: { alignItems: 'center', gap: sawaaSpacing.lg },
  profileMid: { flex: 1, gap: sawaaSpacing.xs },
  profileName: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    color: colors.ink[900],
  },
  profileEmail: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
    color: colors.ink[700],
  },
  group: { marginBottom: sawaaSpacing.lg },
  menuRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: sawaaSpacing.md,
    minHeight: 52,
  },
  menuLeft: { alignItems: 'center', gap: sawaaSpacing.md, flex: 1 },
  menuLabel: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
  },
  menuRight: { alignItems: 'center', gap: sawaaSpacing.sm },
  menuValue: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: colors.ink[500],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: withAlpha(colors.ink[900], 0.08),
    marginHorizontal: sawaaSpacing.md,
  },
  version: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: colors.ink[500],
    textAlign: 'center',
    marginTop: sawaaSpacing.lg,
  },
});
