import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Clock } from 'lucide-react-native';

import { AccountScaffold } from '@/components/features/account/AccountScaffold';
import { AccountHeaderCard } from '@/components/features/account/AccountHeaderCard';
import { AccountPreferences } from '@/components/features/account/AccountPreferences';
import { SignOutRow } from '@/components/features/account/SignOutRow';
import { AboutSection } from '@/components/features/settings/AboutSection';
import { UnverifiedEmailBanner } from '@/components/features/auth/UnverifiedEmailBanner';
import { MenuGroup } from '@/components/ui/MenuGroup';
import { useAppSelector, useAppDispatch } from '@/hooks/use-redux';
import { setUser } from '@/stores/slices/auth-slice';
import { authService } from '@/services/auth';

/** Employee account tab, built from the same account blocks as the client tab. */
export default function EmployeeProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const fullName = user ? `${user.firstName} ${user.lastName}` : '';

  // Refresh /auth/me when the screen gains focus.
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
      return () => { cancelled = true; };
    }, [dispatch]),
  );

  return (
    <AccountScaffold title={t('employee.profile')}>
      <UnverifiedEmailBanner />
      <AccountHeaderCard
        name={fullName}
        secondary={user?.email}
        avatarUrl={user?.avatarUrl}
        onEdit={() => router.push('/(employee)/edit-profile')}
      />
      <MenuGroup entries={[
        { key: 'availability', icon: Clock, label: t('availability.hours'), onPress: () => router.push('/(employee)/availability') },
      ]} />
      <AccountPreferences role="employee" />
      <AboutSection />
      <SignOutRow />
    </AccountScaffold>
  );
}
