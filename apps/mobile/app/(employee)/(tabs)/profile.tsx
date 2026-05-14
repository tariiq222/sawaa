import { useCallback } from 'react';
import { Linking, View, ScrollView, Pressable, Alert, StyleSheet } from 'react-native';
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
  Stethoscope,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/theme/components/ThemedText';
import { Avatar } from '@/components/ui/Avatar';
import { useTheme } from '@/theme/useTheme';
import { UnverifiedEmailBanner } from '@/components/features/auth/UnverifiedEmailBanner';
import { useAppSelector, useAppDispatch } from '@/hooks/use-redux';
import { logout, setUser } from '@/stores/slices/auth-slice';
import { authService } from '@/services/auth';
import { PRIVACY_POLICY_URL } from '@/constants/config';

interface MenuItemProps {
  icon: React.ElementType;
  label: string;
  value?: string;
  danger?: boolean;
  onPress: () => void;
}

function MenuItem({ icon: Icon, label, value, danger, onPress }: MenuItemProps) {
  const { theme, isRTL } = useTheme();
  const Chevron = isRTL ? ChevronLeft : ChevronRight;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: theme.colors.white, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.menuLeft}>
        <Icon size={20} strokeWidth={1.5} color={danger ? theme.colors.error : theme.colors.textSecondary} />
        <ThemedText variant="body" color={danger ? theme.colors.error : theme.colors.textPrimary}>
          {label}
        </ThemedText>
      </View>
      <View style={styles.menuRight}>
        {value && <ThemedText variant="bodySm" color={theme.colors.textSecondary}>{value}</ThemedText>}
        {!danger && <Chevron size={16} strokeWidth={1.5} color={theme.colors.textMuted} />}
      </View>
    </Pressable>
  );
}

export default function EmployeeProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { theme } = useTheme();
  const user = useAppSelector((s) => s.auth.user);

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

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface, paddingTop: insets.top + 16 }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        <UnverifiedEmailBanner />
        <ThemedText variant="displaySm" style={styles.title}>
          {t('employee.profile')}
        </ThemedText>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: theme.colors.white }]}>
          <Avatar size={64} name={fullName} imageUrl={user?.avatarUrl} />
          <View style={{ flex: 1, gap: 4 }}>
            <ThemedText variant="heading">{fullName}</ThemedText>
            <ThemedText variant="bodySm" color={theme.colors.textSecondary}>
              {user?.email}
            </ThemedText>
            <View style={styles.ratingRow}>
              <Star size={14} fill="#F59E0B" color="#F59E0B" />
              <ThemedText variant="bodySm" style={{ fontWeight: '600' }}>
                4.8
              </ThemedText>
              <ThemedText variant="caption" color={theme.colors.textMuted}>
                (120 {t('home.rating')})
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.menuGroup}>
          <MenuItem icon={User} label={t('profile.personalInfo')} onPress={() => {}} />
          <MenuItem icon={Star} label={t('doctor.ratingsReviews')} onPress={() => {}} />
          <MenuItem icon={Globe} label={t('profile.language')} value={t('profile.arabic')} onPress={() => {}} />
          <MenuItem icon={Bell} label={t('profile.notifications')} onPress={() => {}} />
        </View>

        <View style={styles.menuGroup}>
          <MenuItem icon={Info} label={t('profile.about')} onPress={() => {}} />
          <MenuItem icon={Shield} label={t('profile.privacy')} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} />
        </View>

        <View style={styles.menuGroup}>
          <MenuItem icon={LogOut} label={t('auth.logout')} danger onPress={handleLogout} />
        </View>

        <ThemedText variant="caption" color={theme.colors.textMuted} align="center" style={{ marginTop: 16 }}>
          {t('doctor.appVersion')} 1.0.0
        </ThemedText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  title: { marginBottom: 20 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  menuGroup: { gap: 8, marginBottom: 20 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 14,
    paddingHorizontal: 16,
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
