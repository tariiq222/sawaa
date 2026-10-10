import React from 'react';
import { StyleSheet, View } from 'react-native';
import { sawaaSpacing } from '@/theme/sawaa/tokens';
import { useTranslation } from 'react-i18next';

import { SettingsScaffold } from '@/components/features/settings/SettingsScaffold';
import { UnverifiedEmailBanner } from '@/components/features/auth/UnverifiedEmailBanner';
import { SettingsProfileSection } from '@/components/features/settings/SettingsProfileSection';
import { DeleteAccountButton } from '@/components/features/settings/DeleteAccountButton';

/** Purpose-built route: editing the client's own personal data only. */
export default function ProfileSettingsScreen() {
  const { t } = useTranslation();

  return (
    <SettingsScaffold title={t('profile.personalDetails')} keyboardSafe>
      <UnverifiedEmailBanner />
      <SettingsProfileSection />
      <View style={styles.danger}><DeleteAccountButton /></View>
    </SettingsScaffold>
  );
}

const styles = StyleSheet.create({ danger: { marginTop: sawaaSpacing['2xl'] } });
