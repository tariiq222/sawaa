import React from 'react';
import { Linking } from 'react-native';
import Constants from 'expo-constants';
import { Info, Lock, Smartphone } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { getAppVersion } from '@/lib/app-version';
import { PRIVACY_POLICY_URL } from '@/constants/config';
import { MenuGroup } from '@/components/ui/MenuGroup';

/** About block shared by every account screen: privacy policy, version and build. */
export function AboutSection() {
  const { t } = useTranslation();
  const { version, buildNumber } = getAppVersion(Constants);
  return (
    <MenuGroup
      title={t('settings.about')}
      entries={[
        { key: 'privacy', icon: Lock, label: t('settings.privacyPolicy'), onPress: () => { void Linking.openURL(PRIVACY_POLICY_URL); } },
        { key: 'version', icon: Info, label: t('settings.version'), value: version, valueDirection: 'ltr' },
        { key: 'build', icon: Smartphone, label: t('settings.buildNumber'), value: buildNumber, valueDirection: 'ltr' },
      ]}
    />
  );
}
