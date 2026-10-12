import React from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AccountScaffold } from '@/components/features/account/AccountScaffold';
import { AccountPreferences } from '@/components/features/account/AccountPreferences';
import { CenterSupportSection } from '@/components/features/account/CenterSupportSection';
import { AboutSection } from '@/components/features/settings/AboutSection';
import { GuestWelcomeCard } from '@/components/features/guest/GuestWelcomeCard';

/**
 * Guest account tab. Mirrors the client account layout (preferences, support,
 * about) so nothing moves after sign-in, with one sign-in card on top.
 */
export default function GuestAccountScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <AccountScaffold title={t('tabs.profile')}>
      <GuestWelcomeCard onSignIn={() => router.push({ pathname: '/(auth)/login', params: { redirect: '/(client)/(tabs)/account' } })} />
      <AccountPreferences role="guest" />
      <CenterSupportSection />
      <AboutSection />
    </AccountScaffold>
  );
}
