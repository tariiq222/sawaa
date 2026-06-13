import { useCallback } from 'react';
import { Linking, View, ScrollView, Pressable, Alert, StyleSheet, Text } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  User,
  Star,
  Globe,
  Bell,
  Info,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import {
  AquaBackground,
  GlassSurface,
  sawaaColors,
  sawaaRadius,
  sawaaSemantic,
  sawaaSpacing,
  sawaaType,
  withAlpha,
} from '@/theme/sawaa';
import { Avatar } from '@/components/ui/Avatar';
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
  const dir = useDir();
  const f400 = getFontName(dir.locale, '400');
  const Chevron = dir.isRTL ? ChevronLeft : ChevronRight;
  const tint = danger ? sawaaSemantic.danger : sawaaColors.teal[600];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.menuRow, { flexDirection: dir.row, opacity: pressed ? 0.7 : 1 }]}
    >
      <View style={[styles.menuLeft, { flexDirection: dir.row }]}>
        <View style={[styles.menuIconCircle, { backgroundColor: withAlpha(tint, 0.1) }]}>
          <Icon size={18} strokeWidth={1.5} color={tint} />
        </View>
        <Text
          style={[
            styles.menuLabel,
            { fontFamily: f400, fontWeight: '400', color: danger ? sawaaSemantic.danger : sawaaColors.ink[900], writingDirection: dir.writingDirection },
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
        {!danger && <Chevron size={16} strokeWidth={1.5} color={sawaaColors.ink[400]} />}
      </View>
    </Pressable>
  );
}

function MenuGroup({ entries }: { entries: MenuEntry[] }) {
  return (
    <GlassSurface variant="base" radius={sawaaRadius.xl} padding={sawaaSpacing.xs}>
      {entries.map((entry, i) => (
        <View key={entry.label}>
          {i > 0 && <View style={styles.divider} />}
          <MenuRow {...entry} />
        </View>
      ))}
    </GlassSurface>
  );
}

export default function EmployeeProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const dir = useDir();
  const reduceMotion = useReduceMotion();
  const user = useAppSelector((s) => s.auth.user);
  const f400 = getFontName(dir.locale, '400');
  const f600 = getFontName(dir.locale, '600');
  const f700 = getFontName(dir.locale, '700');

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
          router.replace('/(auth)/login');
        },
      },
    ]);
  }, [dispatch, router, t]);

  const soon = () => Alert.alert('قريباً', 'هذه الميزة قيد التطوير');

  return (
    <AquaBackground>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + sawaaSpacing.lg }]}
      >
        <UnverifiedEmailBanner />
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.duration(600).easing(Easing.out(Easing.cubic))}>
          <Text style={[styles.title, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
            {t('employee.profile')}
          </Text>
        </Animated.View>

        <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(100).duration(600).easing(Easing.out(Easing.cubic))}>
          <GlassSurface variant="strong" radius={sawaaRadius.xl} padding={sawaaSpacing.lg} style={styles.profileCard}>
            <View style={[styles.profileRow, { flexDirection: dir.row }]}>
              <Avatar size={64} name={fullName} imageUrl={user?.avatarUrl} color={sawaaColors.teal[600]} />
              <View style={styles.profileMid}>
                <Text style={[styles.profileName, { fontFamily: f700, textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                  {fullName}
                </Text>
                <Text style={[styles.profileEmail, { fontFamily: f400, fontWeight: '400', textAlign: dir.textAlign, writingDirection: dir.writingDirection }]}>
                  {user?.email}
                </Text>
                <View style={[styles.ratingRow, { flexDirection: dir.row }]}>
                  <Star size={14} fill={sawaaSemantic.warning} color={sawaaSemantic.warning} />
                  <Text style={[styles.ratingValue, { fontFamily: f600, fontWeight: '600' }]}>4.8</Text>
                  <Text style={[styles.ratingMeta, { fontFamily: f400, fontWeight: '400', writingDirection: dir.writingDirection }]}>
                    (120 {t('home.rating')})
                  </Text>
                </View>
              </View>
            </View>
          </GlassSurface>
        </Animated.View>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(180).duration(600).easing(Easing.out(Easing.cubic))}
          style={styles.group}
        >
          <MenuGroup
            entries={[
              { icon: User, label: t('profile.personalInfo'), onPress: soon },
              { icon: Star, label: t('doctor.ratingsReviews'), onPress: soon },
              { icon: Globe, label: t('profile.language'), value: t('profile.arabic'), onPress: soon },
              { icon: Bell, label: t('profile.notifications'), onPress: soon },
            ]}
          />
        </Animated.View>

        <Animated.View
          entering={reduceMotion ? undefined : FadeInDown.delay(260).duration(600).easing(Easing.out(Easing.cubic))}
          style={styles.group}
        >
          <MenuGroup
            entries={[
              { icon: Info, label: t('profile.about'), onPress: () => Alert.alert('مركز سواء', 'نسخة 1.0.0') },
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
          {t('doctor.appVersion')} 1.0.0
        </Text>
      </ScrollView>
    </AquaBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: sawaaSpacing.lg, paddingBottom: 140 },
  title: {
    fontSize: sawaaType.heading.fontSize,
    lineHeight: sawaaType.heading.lineHeight,
    color: sawaaColors.ink[900],
    marginBottom: sawaaSpacing.xl,
  },
  profileCard: { marginBottom: sawaaSpacing['2xl'] },
  profileRow: { alignItems: 'center', gap: sawaaSpacing.lg },
  profileMid: { flex: 1, gap: sawaaSpacing.xs },
  profileName: {
    fontSize: sawaaType.subheading.fontSize,
    lineHeight: sawaaType.subheading.lineHeight,
    color: sawaaColors.ink[900],
  },
  profileEmail: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: sawaaColors.ink[500],
  },
  ratingRow: { alignItems: 'center', gap: sawaaSpacing.xs },
  ratingValue: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: sawaaColors.ink[900],
  },
  ratingMeta: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: sawaaColors.ink[400],
  },
  group: { marginBottom: sawaaSpacing.xl },
  menuRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: sawaaSpacing.md,
  },
  menuLeft: { alignItems: 'center', gap: sawaaSpacing.md, flex: 1 },
  menuIconCircle: {
    width: 36,
    height: 36,
    borderRadius: sawaaRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: sawaaType.body.fontSize,
    lineHeight: sawaaType.body.lineHeight,
  },
  menuRight: { alignItems: 'center', gap: sawaaSpacing.sm },
  menuValue: {
    fontSize: sawaaType.caption.fontSize,
    lineHeight: sawaaType.caption.lineHeight,
    color: sawaaColors.ink[500],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: withAlpha(sawaaColors.ink[900], 0.08),
    marginHorizontal: sawaaSpacing.md,
  },
  version: {
    fontSize: sawaaType.micro.fontSize,
    lineHeight: sawaaType.micro.lineHeight,
    color: sawaaColors.ink[400],
    textAlign: 'center',
    marginTop: sawaaSpacing.lg,
  },
});
