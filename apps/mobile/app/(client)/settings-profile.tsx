import React from 'react';
import { useTranslation } from 'react-i18next';

import { SettingsScaffold } from '@/components/features/settings/SettingsScaffold';
import { UnverifiedEmailBanner } from '@/components/features/auth/UnverifiedEmailBanner';
import { SettingsProfileSection } from '@/components/features/settings/SettingsProfileSection';
import { DeleteAccountButton } from '@/components/features/settings/DeleteAccountButton';

/** Purpose-built route: editing the client's own personal data only. */
export default function ProfileSettingsScreen() {
  const { t } = useTranslation();

  return (
    <SettingsScaffold title={t('settings.profile')}>
      <UnverifiedEmailBanner />
      <SettingsProfileSection />
      <DeleteAccountButton />
    </SettingsScaffold>
  );
}
